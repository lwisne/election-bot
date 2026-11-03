# Michigan early vote and county margins

`uf_mi_county_2026.csv` is https://election.lab.ufl.edu/data-downloads/earlyvote/2026/MI_county.csv fetched on 2026-11-03. The paired statewide file `US.csv` has `last_update` 11/2/2026 and `voted_all` 2,313,206. The county `voted_all` values sum to that statewide total. UF's note says Michigan does not identify voting mode, and the in-person column is estimated from mail applications. This calculation uses `voted_all` only.

`uf_mi_county_2024.csv` is https://election.lab.ufl.edu/data-downloads/earlyvote/2024/county_data_MI.csv. It is the election-day snapshot. UF reported mail and in-person together, so `voted_all` equals mail returned.

`medsl_mi_president_2024.csv` is the Michigan rows of MIT Election Data and Science Lab county presidential returns for 2024, CC0, via https://api.electiondata.dev/v1/county-president/table/2024.csv (Harvard Dataverse doi:10.7910/DVN/VOQCHQ). `dem` and `rep` are the Democratic and Republican candidate votes.

`sos_2022_av_received_by_county.csv` rolls up the Michigan Department of State spreadsheet `10-31-2022-PR-Nov-2022-AV--Ballot-Stats.xlsx`, linked from the November 1, 2022 press release https://www.michigan.gov/sos/resources/news/2022/11/01/one-week-before-election-day-nearly-2-million-michiganders-have-requested-absentee-ballots. Each jurisdiction's `BALLOTS RECEIVED` is summed to the county. The sheet total is 1,126,246. This is the absentee file as of October 31, 2022, one week before the November 8 election, not the final election-day return total. UF has no 2022 Michigan county early-vote file. Michigan had no statewide early in-person voting in 2022. These are absentee ballots received.

`governor_2022_county.csv` is the Governor rows of OpenElections `20221108__mi__general__county.csv` (https://github.com/openelections/openelections-data-mi). Whitmer sums to 2,430,505 and Dixon to 1,960,635, which match the certified statewide totals published by the Michigan Secretary of State. The Michigan Voter Information Center county file is behind Cloudflare and was not fetched.
