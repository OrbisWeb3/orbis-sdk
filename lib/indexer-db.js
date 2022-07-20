import { createClient } from '@supabase/supabase-js'

const url = "https://ylgfjdlgyjmdikqavpcj.supabase.co"
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZ2ZqZGxneWptZGlrcWF2cGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTQ3NTc3NTIsImV4cCI6MTk3MDMzMzc1Mn0.2XdkerM98LhI6q5MBBaXRq75yxOSy-JVbwtTz6Dn9d0";

export const indexer = createClient(url, key);
