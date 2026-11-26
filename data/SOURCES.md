# Data sources

## hillstrom.csv (dataset P04)
Kevin Hillstrom, *MineThatData E-Mail Analytics and Data Mining Challenge* (March 2008), https://blog.minethatdata.com/2008/03/.
Downloaded from the URL used by the course starter notebook:
https://raw.githubusercontent.com/AdityaDabrase/ab-testing-email-marketing/main/data/raw/hillstrom.csv
64,000 rows × 12 columns. Verified: 21,307 / 21,387 / 21,306 customers in the men's / women's / no-email arms.

## concrete.csv (dataset P01)
Yeh, I.-C. (1998). Concrete Compressive Strength [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5PK67 (CC BY 4.0).
The UCI host was not reachable from our build environment, so we used the identical copy in the Rdatasets archive (`modeldata::concrete`):
https://raw.githubusercontent.com/vincentarelbundock/Rdatasets/master/csv/modeldata/concrete.csv
with the row-number column dropped. Verified against the UCI documentation: 1,030 rows, 9 columns, no missing values. Column means match UCI (cement 281.17 kg/m³, strength 35.82 MPa).
