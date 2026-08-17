import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zmsfhwirnmyejnydcwki.supabase.co/rest/v1/';
const supabaseKey = 'sb_publishable_Uuu3EoCjkCZQUAe37m8X7w_QcxilB0H';

export const supabase = createClient(supabaseUrl, supabaseKey);