from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from typing import Tuple 
device = "cuda:0" if torch.cuda.is_available() else "cpu"

tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert").to(device)
labels = ["positive", "negative", "neutral"]




app = Flask(__name__)
CORS(app)  # Enable CORS to allow requests from different origins

def fetch_historical_data(symbol, start_date, end_date):
    stock_data = yf.download(symbol, start=start_date, end=end_date)
    return stock_data

def generate_features(stock_data):
    stock_data['Returns'] = stock_data['Close'].pct_change()
    stock_data['50_MA'] = stock_data['Close'].rolling(window=50).mean()
    stock_data['200_MA'] = stock_data['Close'].rolling(window=200).mean()
    stock_data['50_200'] = stock_data['50_MA'] - stock_data['200_MA']
    stock_data.dropna(inplace=True)
    stock_data['Target'] = np.where(stock_data['Returns'].shift(-1) > 0, 1, 0)
    return stock_data

def train_model(data):
    features = data[['50_MA', '200_MA', '50_200', 'Returns']]
    target = data['Target']
    X_train, X_test, y_train, y_test = train_test_split(
        features, target, test_size=0.2, random_state=42)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    print("Model Accuracy:", accuracy_score(y_test, predictions))
    print("Classification Report:\n", classification_report(y_test, predictions))
    return model

def generate_ml_signals(data, model):
    features = data[['50_MA', '200_MA', '50_200', 'Returns']]
    data['ML_Signal'] = model.predict(features)
    return data

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    symbol = data['symbol']
    start_date = data['start_date']
    end_date = data['end_date']

   
    stock_data = fetch_historical_data(symbol, start_date, end_date)

    stock_data = generate_features(stock_data)
    model = train_model(stock_data)
    stock_data = generate_ml_signals(stock_data, model)

    latest_data = stock_data.iloc[-1]
    trading_signal = get_trading_signal(latest_data)

    # Reset index to get dates as a column
    stock_data.reset_index(inplace=True)

    # Prepare data to send to front-end
    signals = stock_data.to_dict(orient='records')

    return jsonify({'signals': signals, 'trading_signal': trading_signal})

def get_trading_signal(data):
    if data['50_MA'] > data['200_MA']:
        return 'BUY'
    elif data['50_MA'] < data['200_MA']:
        return 'SELL'
    else:
        return 'HOLD'
    

@app.route('/news-impact', methods=['POST'])    
def news_impact():
    data = request.get_json()
    news = data['headline']
    if news:
        tokens = tokenizer(news, return_tensors="pt", padding=True).to(device)

        result = model(tokens["input_ids"], attention_mask=tokens["attention_mask"])[
            "logits"
        ]
        result = torch.nn.functional.softmax(torch.sum(result, 0), dim=-1)
        probability = result[torch.argmax(result)]
        sentiment = labels[torch.argmax(result)]
        return jsonify(round(probability.item() * 100, 2), sentiment)
    else:
        return 0, labels[-1]

if __name__ == '__main__':
    app.run(debug=True)
