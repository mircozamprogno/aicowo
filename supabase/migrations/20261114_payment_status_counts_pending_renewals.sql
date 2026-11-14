-- contract_payment_status: account for pending payments (e.g. renewal cycles).
--
-- The view compared completed payments against service_cost (one period) and
-- ignored pending rows. After an auto-renewal the first period's completed
-- payment already covered service_cost, so a renewed contract still showed
-- "paid" with outstanding 0 although the renewal payment was pending.
--
-- Now, when a contract has pending payments:
--   - payment_status is 'partial' (something already paid) or 'unpaid'
--   - outstanding_amount is the sum of pending payments
--   - next_due_date is the earliest pending due date
--   - is_overdue is true when a pending payment is past its due date
-- Contracts without pending payments keep the previous behaviour.

create or replace view public.contract_payment_status as
with agg as (
  select
    c.id as contract_id,
    c.contract_number,
    c.partner_uuid,
    cu.first_name  as customer_first_name,
    cu.second_name as customer_second_name,
    cu.company_name as customer_company_name,
    c.service_cost,
    c.service_currency,
    c.service_type,
    c.start_date,
    pp.plan_type,
    pp.next_payment_date,
    coalesce(sum(case when p.payment_status = 'completed' then p.amount else 0 end), 0) as paid,
    coalesce(sum(case when p.payment_status = 'pending'   then p.amount else 0 end), 0) as pending,
    count(*) filter (where p.payment_status = 'pending') as pending_count,
    min(p.due_date) filter (where p.payment_status = 'pending') as next_pending_due,
    max(p.payment_date) as last_payment_date,
    count(p.id) as payment_count
  from contracts c
    left join customers cu on c.customer_id = cu.id
    left join payments p on c.id = p.contract_id
    left join payment_plans pp on c.id = pp.contract_id
  where c.is_archived = false
  group by c.id, c.contract_number, c.partner_uuid, cu.first_name, cu.second_name,
           cu.company_name, c.service_cost, c.service_currency, c.service_type,
           c.start_date, pp.plan_type, pp.next_payment_date
),
due as (
  select a.*,
    case
      when a.next_pending_due is not null then a.next_pending_due::timestamp
      when a.plan_type is not null then a.next_payment_date::timestamp
      else a.start_date + interval '1 mon'
    end as next_due
  from agg a
)
select
  contract_id,
  contract_number,
  partner_uuid,
  customer_first_name,
  customer_second_name,
  customer_company_name,
  service_cost as total_amount,
  service_currency as currency,
  paid as paid_amount,
  pending as pending_amount,
  case
    when pending_count > 0 then pending
    else service_cost - paid
  end as outstanding_amount,
  case
    when service_cost = 0 or service_type = 'free_trial' then 'not_required'
    when pending_count > 0 and paid > 0 then 'partial'
    when pending_count > 0 then 'unpaid'
    when paid = 0 then 'unpaid'
    when paid >= service_cost then 'paid'
    else 'partial'
  end as payment_status,
  next_due as next_due_date,
  case
    when service_cost = 0 or service_type = 'free_trial' then false
    when pending_count > 0 then next_due < current_date
    when next_due < current_date and paid < service_cost then true
    else false
  end as is_overdue,
  last_payment_date,
  payment_count
from due;
