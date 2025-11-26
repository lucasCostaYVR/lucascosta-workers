
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://atkjduguvytxnrxxcidc.supabase.co";
const supabaseKey = "sb_secret_bkklMlZ3TXQSv2BoZ9fNvw_Rrym9YLb";

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectEventTypes() {
  console.log("# Inspecting Event Types for Conversions\n");

  // Fetch specific conversion events
  const { data: events, error } = await supabase
    .from('marketing_events')
    .select('type, traits')
    .in('type', ['newsletter.subscribed', 'contact.submitted'])
    .limit(10);

  if (error) {
    console.error("Error fetching events:", error);
    return;
  }

  console.log(`\n## Conversion Events Found: ${events.length}`);
  events.forEach(e => {
    console.log(`- ${e.type}`);
    console.log(`  Traits: ${JSON.stringify(e.traits)}`);
  });

}

inspectEventTypes();
