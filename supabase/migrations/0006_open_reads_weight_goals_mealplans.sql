-- ============================================================
-- Item 4: weight & goals become readable by everyone (writes stay self-or-coach).
-- Also opening `fighters` itself (now just daily_calorie_target) — the shared
-- roster view needs to read every fighter row, not just your own.
-- ============================================================
drop policy "fighters_select_self_or_coach" on public.fighters;
create policy "fighters_select_authenticated" on public.fighters
  for select using (auth.role() = 'authenticated');

drop policy "weight_select_self_or_coach" on public.weight_entries;
create policy "weight_select_authenticated" on public.weight_entries
  for select using (auth.role() = 'authenticated');

drop policy "goals_select_self_or_coach" on public.goals;
create policy "goals_select_authenticated" on public.goals
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Item 3: meal PLANS (the weekly template) become readable by everyone.
-- meal_entries (the daily food log) intentionally stays private (self-or-coach) —
-- out of scope, a running log of what someone actually ate is more personal
-- than a template plan.
-- ============================================================
drop policy "meal_plans_select_self_or_coach" on public.meal_plans;
create policy "meal_plans_select_authenticated" on public.meal_plans
  for select using (auth.role() = 'authenticated');

drop policy "meal_plan_items_select_self_or_coach" on public.meal_plan_items;
create policy "meal_plan_items_select_authenticated" on public.meal_plan_items
  for select using (auth.role() = 'authenticated');
