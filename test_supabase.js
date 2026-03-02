import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data, error } = await supabase
        .from('contract_payment_status')
        .select(`
      contract_id,
      contract_number,
      outstanding_amount,
      currency,
      next_due_date,
      payment_status,
      is_overdue,
      contracts!inner (
        partner_uuid,
        customers (
          first_name,
          second_name,
          company_name
        )
      )
    `);

    if (error) {
        console.error("ERROR:", error);
    } else {
        console.log("SUCCESS length:", data?.length);
    }
}

test();
