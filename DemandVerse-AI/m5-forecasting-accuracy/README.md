# M5 Forecasting - Accuracy Dataset

This directory is designated for the Kaggle **M5 Forecasting - Accuracy** dataset files.

> [!NOTE]
> Large raw CSV files (`sales_train_evaluation.csv`, `sales_train_validation.csv`, `sell_prices.csv`) exceed GitHub's 100MB file limit and are tracked via `.gitignore`. 
>
> All preprocessed, cleaned, and feature-engineered datasets needed for the API and dashboard are already packaged and ready-to-run inside [`demandverse_ai_outputs/`](../demandverse_ai_outputs/).

### How to Download Raw Data
If you wish to re-run the end-to-end data preparation notebook (`DS_Project_Implementation_2.ipynb`) from scratch:
1. Download the dataset from [Kaggle M5 Forecasting - Accuracy](https://www.kaggle.com/competitions/m5-forecasting-accuracy).
2. Or use the Kaggle CLI:
   ```bash
   kaggle competitions download -c m5-forecasting-accuracy
   unzip m5-forecasting-accuracy.zip -d m5-forecasting-accuracy/
   ```
3. Place the extracted files (`calendar.csv`, `sales_train_validation.csv`, `sell_prices.csv`) into this directory.
