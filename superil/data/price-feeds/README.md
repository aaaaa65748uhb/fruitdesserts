# Official price files (git-ignored)

Download files manually from the chain's official price-publication portal (list of chains:
https://www.gov.il/he/departments/legalInfo/cpfta_prices_regulations). Keep the original file names.
Then preview and import:

```bash
npm run prices -- preview data/price-feeds/<file> --retailer <id>
npm run prices -- import  data/price-feeds/<file> --retailer <id>
```

Full guide: docs/INTEGRATIONS.md, section 6.
