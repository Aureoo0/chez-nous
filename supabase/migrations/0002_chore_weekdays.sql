-- Corvées à jours fixes : « chaque dimanche », « mardi et vendredi ».
-- weekdays : 0 = dimanche … 6 = samedi. Vide (null) = la corvée suit every_days comme avant.
-- schedule_start : à partir de quand les jours comptent, pour ne pas être « en retard » dès qu'on les choisit.
alter table public.chores
  add column weekdays smallint[]
    check (weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])),
  add column schedule_start date;
