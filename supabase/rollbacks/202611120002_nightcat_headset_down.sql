-- Remove the Nightcat Headset and restore the previous sort order.

begin;

delete from public.companion_worn_cosmetics where cosmetic_id = 'nightcat-headset';
delete from public.companion_owned_cosmetics where cosmetic_id = 'nightcat-headset';
delete from public.companion_cosmetic_catalog where id = 'nightcat-headset';

update public.companion_cosmetic_catalog
  set sort_order = sort_order + 100
  where sort_order >= 16;
update public.companion_cosmetic_catalog
  set sort_order = sort_order - 101
  where sort_order >= 116;

notify pgrst, 'reload schema';
commit;
