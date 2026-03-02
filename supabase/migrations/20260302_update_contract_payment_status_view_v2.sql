create or replace view public.contract_payment_status as
select
  c.id as contract_id,
  c.contract_number,
  c.partner_uuid,
  cu.first_name as customer_first_name,
  cu.second_name as customer_second_name,
  cu.company_name as customer_company_name,
  c.service_cost as total_amount,
  c.service_currency as currency,
  COALESCE(
    sum(
      case
        when p.payment_status::text = 'completed'::text then p.amount
        else 0::numeric
      end
    ),
    0::numeric
  ) as paid_amount,
  COALESCE(
    sum(
      case
        when p.payment_status::text = 'pending'::text then p.amount
        else 0::numeric
      end
    ),
    0::numeric
  ) as pending_amount,
  c.service_cost - COALESCE(
    sum(
      case
        when p.payment_status::text = 'completed'::text then p.amount
        else 0::numeric
      end
    ),
    0::numeric
  ) as outstanding_amount,
  case
    when c.service_cost = 0::numeric
    or c.service_type::text = 'free_trial'::text then 'not_required'::text
    when COALESCE(
      sum(
        case
          when p.payment_status::text = 'completed'::text then p.amount
          else 0::numeric
        end
      ),
      0::numeric
    ) = 0::numeric then 'unpaid'::text
    when COALESCE(
      sum(
        case
          when p.payment_status::text = 'completed'::text then p.amount
          else 0::numeric
        end
      ),
      0::numeric
    ) >= c.service_cost then 'paid'::text
    when COALESCE(
      sum(
        case
          when p.payment_status::text = 'completed'::text then p.amount
          else 0::numeric
        end
      ),
      0::numeric
    ) > 0::numeric then 'partial'::text
    else 'unpaid'::text
  end as payment_status,
  case
    when pp.plan_type is not null then pp.next_payment_date::timestamp without time zone
    else c.start_date + interval '1 month'
  end as next_due_date,
  case
    when c.service_cost = 0::numeric
    or c.service_type::text = 'free_trial'::text then false
    when case
      when pp.plan_type is not null then pp.next_payment_date::timestamp without time zone
      else c.start_date + interval '1 month'
    end < CURRENT_DATE
    and COALESCE(
      sum(
        case
          when p.payment_status::text = 'completed'::text then p.amount
          else 0::numeric
        end
      ),
      0::numeric
    ) < c.service_cost then true
    else false
  end as is_overdue,
  max(p.payment_date) as last_payment_date,
  count(p.id) as payment_count
from
  contracts c
  left join customers cu on c.customer_id = cu.id
  left join payments p on c.id = p.contract_id
  left join payment_plans pp on c.id = pp.contract_id
where
  c.is_archived = false
group by
  c.id,
  c.contract_number,
  c.partner_uuid,
  cu.first_name,
  cu.second_name,
  cu.company_name,
  c.service_cost,
  c.service_currency,
  c.service_type,
  c.start_date,
  pp.plan_type,
  pp.next_payment_date;
