import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';

export interface NotionPost {
  id: string;
  slug: string;
  title: string;
  content: string; // MDX
  published: boolean;
  publishedAt: string | null;
  tags: string[];
  summary: string | null;
  featuredImage: string | null;
}

export interface NotionSnippet {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string; // MDX
  category: string;
  published: boolean;
  publishedAt: string | null;
  tags: string[];
}

export class NotionClient {
  private client: Client;
  private n2m: NotionToMarkdown;
  private assetsBucket?: R2Bucket;
  private apiKey: string;

  constructor(apiKey: string, assetsBucket?: R2Bucket) {
    this.apiKey = apiKey;
    this.client = new Client({ 
      auth: apiKey,
      fetch: (url, init) => {
        return fetch(url, init);
      }
    });
    this.n2m = new NotionToMarkdown({ notionClient: this.client });
    this.assetsBucket = assetsBucket;

    if (this.assetsBucket) {
      this.setupImageTransformer();
    }
  }

  /**
   * Create a new page in a Notion database
   */
  async createPage(databaseId: string, properties: any) {
    return await this.client.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
  }

  /**
   * Update an existing page
   */
  async updatePage(pageId: string, properties: any) {
    return await this.client.pages.update({
      page_id: pageId,
      properties,
    });
  }

  /**
   * Query database for a page by property value
   */
  async queryDatabaseByProperty(databaseId: string, propertyName: string, propertyValue: any) {
    const filter: any = {
      property: propertyName,
    };

    // Handle different property types
    if (propertyValue.title) {
      filter.title = { equals: propertyValue.title[0].text.content };
    } else if (propertyValue.rich_text) {
      filter.rich_text = { equals: propertyValue.rich_text[0].text.content };
    } else {
      throw new Error(`Unsupported property type for querying: ${propertyName}`);
    }

    // Use direct REST API call instead of SDK method (Workers compatibility)
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter }),
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.results.length > 0 ? data.results[0] : null;
  }

  /**
   * Clear all pages in a Notion database
   */
  async clearDatabase(databaseId: string) {
    const response = await this.client.databases.retrieve({ database_id: databaseId });
    // Note: Actual clearing would require querying pages separately
    // For now, we'll skip clearing and just overwrite/add new data
  }

  private async processImage(imageUrl: string, id: string): Promise<string | null> {
    if (!this.assetsBucket || !imageUrl) return null;

    try {
      const filename = `${id}-${new URL(imageUrl).pathname.split('/').pop()}`;
      const r2Key = `notion-images/${filename}`;
      
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      
      await this.assetsBucket.put(r2Key, blob.stream(), {
          httpMetadata: {
              contentType: response.headers.get('content-type') || 'image/jpeg',
          }
      });
      
      // Construct public URL
      return `https://assets.lucascosta.tech/${r2Key}`;
    } catch (error) {
      console.error('Failed to process image', error);
      return null;
    }
  }

  private setupImageTransformer() {
    this.n2m.setCustomTransformer('image', async (block) => {
      const { image } = block as any;
      if (!image) return false;

      let imageUrl = '';
      if (image.type === 'file') {
        imageUrl = image.file.url;
      } else if (image.type === 'external') {
        imageUrl = image.external.url;
      }

      if (!imageUrl) return false;

      const publicUrl = await this.processImage(imageUrl, block.id);
      
      if (publicUrl) {
        return `![${image.caption?.[0]?.plain_text || 'image'}](${publicUrl})`;
      }

      return false;
    });
  }

  async getDatabase(databaseId: string) {
    const response = await (this.client.databases as any).query({
      database_id: databaseId,
      filter: {
        property: 'Status',
        status: {
          equals: 'Published',
        },
      },
    });
    return response.results;
  }

  async getPage(pageId: string) {
    return await this.client.pages.retrieve({ page_id: pageId });
  }

  async pageToMdx(pageId: string): Promise<string> {
    const mdblocks = await this.n2m.pageToMarkdown(pageId);
    const mdString = this.n2m.toMarkdownString(mdblocks);
    return mdString.parent;
  }

  private async parsePage(page: any): Promise<NotionPost | null> {
    if (!('properties' in page)) return null;
      
    const props = page.properties as any;
    
    // Skip pages without a Name (title) - must be first check
    if (!props.Name?.title?.[0]?.plain_text) {
      return null;
    }
    
    // Extract properties - adjusting based on common Notion setups
    // Assuming properties: Name (title), Slug (text), Status (status), PublishedDate (date), Tags (multi_select), Summary (text)
    
    const title = props.Name.title[0].plain_text;
    const slug = props.Slug?.rich_text?.[0]?.plain_text || page.id;
    const published = props.Status?.status?.name === 'Published';
    // Support both "Published Date" (with space) and "PublishedDate" property names
    const publishedAt = props['Published Date']?.date?.start || props.PublishedDate?.date?.start || null;
    const tags = props.Tags?.multi_select?.map((t: any) => t.name) || [];
    const summary = props.Summary?.rich_text?.[0]?.plain_text || null;

    // Extract Featured Image
    let featuredImageUrl = null;
    const featuredImageProp = props['Featured Image'] || props.FeaturedImage || props.featured_image;
    if (featuredImageProp?.files?.length > 0) {
      const file = featuredImageProp.files[0];
      if (file.type === 'file') {
        featuredImageUrl = file.file.url;
      } else if (file.type === 'external') {
        featuredImageUrl = file.external.url;
      }
    }

    // Process Featured Image (Upload to R2)
    let featuredImage = null;
    if (featuredImageUrl) {
      featuredImage = await this.processImage(featuredImageUrl, `featured-${page.id}`);
    }

    const content = await this.pageToMdx(page.id);

    return {
      id: page.id,
      slug,
      title,
      content,
      published,
      publishedAt,
      tags,
      summary,
      featuredImage
    };
  }

  async getPost(pageId: string): Promise<NotionPost | null> {
    const page = await this.getPage(pageId);
    return this.parsePage(page);
  }

  async getAllPosts(databaseId: string): Promise<NotionPost[]> {
    const pages = await this.getDatabase(databaseId);
    const posts: NotionPost[] = [];

    for (const page of pages) {
      const post = await this.parsePage(page);
      if (post) {
        posts.push(post);
      }
    }

    return posts;
  }

  private async parseSnippet(page: any): Promise<NotionSnippet | null> {
    if (!('properties' in page)) return null;
      
    const props = page.properties as any;
    
    // Skip pages without a Name (title)
    if (!props.Name?.title?.[0]?.plain_text) {
      return null;
    }
    
    const title = props.Name.title[0].plain_text;
    const slug = props.Slug?.rich_text?.[0]?.plain_text || page.id;
    const published = props.Status?.status?.name === 'Published';
    // Support both "Published Date" (with space) and "PublishedDate" property names
    const publishedAt = props['Published Date']?.date?.start || props.PublishedDate?.date?.start || null;
    const category = props.Category?.select?.name || 'Uncategorized';
    const tags = props.Tags?.multi_select?.map((t: any) => t.name) || [];
    const description = props.Description?.rich_text?.[0]?.plain_text || null;

    const content = await this.pageToMdx(page.id);

    return {
      id: page.id,
      slug,
      title,
      description,
      content,
      category,
      published,
      publishedAt,
      tags
    };
  }

  async getSnippet(pageId: string): Promise<NotionSnippet | null> {
    const page = await this.getPage(pageId);
    return this.parseSnippet(page);
  }

  async getAllSnippets(databaseId: string): Promise<NotionSnippet[]> {
    // Don't filter by status - sync both drafts and published (same as posts)
    const response = await (this.client.databases as any).query({
      database_id: databaseId
    });
    
    const snippets: NotionSnippet[] = [];
    for (const page of response.results) {
      const snippet = await this.parseSnippet(page);
      if (snippet) {
        snippets.push(snippet);
      }
    }
    return snippets;
  }
}
