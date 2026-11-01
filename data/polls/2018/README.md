# 2018 Senate polls and results

`electoral_vote_senate_polls.csv` is the Senate file linked from https://www.electoral-vote.com/evp2018/Info/data.html as `Senate/senate_polls.csv`. One row is one poll. `Dem` and `GOP` are percentages. Rows whose pollster starts with `Election` are the site's result lines, not polls.

`fte_senate_polls_2018.csv` is the `cycle == 2018` rows of FiveThirtyEight's `senate_polls_historical.csv`. The live projects.fivethirtyeight.com URL now redirects to an ABC News HTML page. This copy is the Internet Archive snapshot `http://web.archive.org/web/20250306125405/https://projects.fivethirtyeight.com/polls-page/data/senate_polls_historical.csv`. Values are unchanged. The 2020, 2022, and 2024 cycles in that file are not included.

`senate_seat_forecast.csv` is not here. `https://projects.fivethirtyeight.com/congress-model-2018/senate_seat_forecast.csv` also redirects to HTML. That file is a forecast, not raw polls.

`august_senate_polls.csv` is https://github.com/fivethirtyeight/data/blob/master/august-senate-polls/august_senate_polls.csv. Its cycles run from 1990 through 2016. It has no 2018 rows, so the average does not use it.

RealClearPolitics `https://www.realclearpolitics.com/elections/2018/` returned HTTP 403. No RCP averages are included.

`medsl_senate_2018.csv` is the 2018 general rows of MIT Election Data and Science Lab, U.S. Senate statewide 1976-2024, https://doi.org/10.7910/DVN/PEJ5QU, file `1976-2024-senate-state.csv` via the Dataverse API. CC0.

## Average

Election day is 2018-11-06. A poll counts if its end date is from 2018-10-16 through 2018-11-05, the three weeks before election day.

One poll per pollster per race. If a pollster has more than one poll in the window, only polls that end on that pollster's latest end date are kept. The race average is the mean of `Democratic percentage - Republican percentage`.

Electoral Vote pollster names drop a trailing `-<digits>` length suffix. Result rows are dropped.

FiveThirtyEight rows must be `stage == general` or `jungle primary`, `hypothetical == false`, not an internal poll, and not a party-sponsored poll. A question is one matchup. The Democratic side is the highest percentage among candidates who are not Republicans, which keeps Angus King and Bernie Sanders on the Democratic side of the subtraction. The Republican side is the highest `REP` percentage. If the question has no Republican, the margin is the leader minus the runner-up. Mississippi's special is coded `jungle primary`, not `general`.

The actual margin uses the same Democratic-minus-Republican direction. The Democratic side is the leading Democrat, or the leading non-Republican when that candidate outpolled the Democrat (Maine and Vermont). California has two Democrats and no Republican, so the margin is the leader minus the runner-up. The Mississippi special file contains only Hyde-Smith and Espy, which is the runoff, not the November 6 jungle.

Error is the polling average minus the actual margin. A positive error means the polls were more Democratic than the result.
