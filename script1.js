const baseURL = 'https://paper-api.alpaca.markets';

const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'APCA-API-KEY-ID': 'PKO32H6THJMVGE4AXOJY',
          'APCA-API-SECRET-KEY': 'lxVil0RDenpjDdOthv3NUUYFw1M4ejykd1r8zvd2'
        }
      };
async function getNews(){
    try {
        const response = await fetch('https://data.alpaca.markets/v1beta1/news?sort=desc', options);
        const data = await response.json()  
        
        const headlines = extractHeadlines(data);
        console.log('Extracted Headlines:', headlines);
        console.log(typeof(headlines));
        return headlines
    }
        
        catch(err){
            console.error('Error fetching news:', err);
            return []; 
        }
    
      }
      
      function extractHeadlines(newsData) {
        if (!newsData || !Array.isArray(newsData.news)) {
          console.error('Invalid news data format');
          return [];
        }
      
        return newsData.news.map(article =>{return {
            headline: article.headline,
            symbols: article.symbols 
        };});
      }


document.addEventListener("DOMContentLoaded", () => {
    const stockForm = document.getElementById("stockForm");
    const startSentimentButton = document.getElementById("startSentiment");
    const sentimentResultBox = document.getElementById("sentimentResult");
    const scoreDisplay = document.getElementById("scoreDisplay");
    const sentimentDisplay = document.getElementById("sentimentDisplay");
    const actionDisplay = document.getElementById("actionDisplay");


  stockForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const symbol = document.getElementById('symbol').value;
    const startDate = document.getElementById('start').value;
    const endDate = document.getElementById('end').value;

    fetch('http://127.0.0.1:5000/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            symbol: symbol,
            start_date: startDate,
            end_date: endDate
        })
    })
    .then(response => response.json())
    .then(data => {
        const signals = data.signals;

        const labels = signals.map(signal => signal.Date.substring(0, 10)); 
        const prices = signals.map(signal => signal.Close);
        const ma50 = signals.map(signal => signal['50_MA']);
        const ma200 = signals.map(signal => signal['200_MA']);
        const mlSignals = signals.map(signal => signal.ML_Signal);

        drawChart(labels, prices, ma50, ma200, mlSignals);
    })
    .catch(error => console.error('Error:', error));
});

startSentimentButton.addEventListener("click", async function() {
    const headlines = await getNews()
    for (let { headline, symbols } of headlines) {
        console.log(headline, symbols)
         fetch("http://127.0.0.1:5000/news-impact", {  
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ headline: headline })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data)
        const score = parseFloat(data[0])
        const sentiment = data[1]
        let symbol = "SPY"
        if (symbols && Array.isArray(symbols) && symbols.length > 0){
            symbol = symbols[0]
        }
        console.log(`Score: ${score}, Sentiment: ${sentiment}`);

        scoreDisplay.textContent = `Impact Score: ${score}%`;
        sentimentDisplay.textContent = `Sentiment: ${sentiment}`;
        
        let action = determineAction(score, sentiment, symbol)
        actionDisplay.innerHTML = `Action: <span>${action}</span>`;

        sentimentResultBox.style.display = "block";
    })
    .catch(error => {
        console.error('Error:', error);
        sentimentDisplay.textContent = "Error fetching sentiment data.";
    });
    }
    
    
});

const options2 = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'APCA-API-KEY-ID': 'PKO32H6THJMVGE4AXOJY',
      'APCA-API-SECRET-KEY': 'lxVil0RDenpjDdOthv3NUUYFw1M4ejykd1r8zvd2'
    }
  };


async function buyStock(symbol, quantity=1) {
    const url = `${baseURL}/v2/orders`;
    const body = JSON.stringify({
      symbol: symbol,
      qty: quantity,
      side: 'buy',
      type: 'market',
      time_in_force: 'gtc'  // Good 'til canceled
    });
  
    try {
      const response = await fetch(url, { ...options2, body });
      const data = await response.json();
      console.log('Buy order successful:', data);
      return data;
    } catch (error) {
      console.error('Error placing buy order:', error);
    }
  }
  
  // Function to place a sell order
  async function sellStock(symbol, quantity=1) {
    const url = `${baseURL}/v2/orders`;
    const body = JSON.stringify({
      symbol: symbol,
      qty: quantity,
      side: 'sell',
      type: 'market',
      time_in_force: 'gtc'  // Good 'til canceled
    });
  
    try {
      const response = await fetch(url, { ...options2, body });
      const data = await response.json();
      console.log('Sell order successful:', data);
      return data;
    } catch (error) {
      console.error('Error placing sell order:', error);
    }
  }


function determineAction(score, sentiment, symbol) {
    if (sentiment === 'positive'){
        if (score > 60){
            buyStock(symbol)
            return "BUY"
        }
        return "HOLD"
        
    }
    if (sentiment === 'negative'){
        if (score > 60){
            sellStock(symbol)
            return "SELL"
            
        }
        return "HOLD"
    }
    return "HOLD"
}

// Function to draw the chart with stock data
function drawChart(labels, prices, ma50, ma200, mlSignals) {
    const ctx = document.getElementById('stockChart').getContext('2d');

    const buySignals = mlSignals.map((signal, index) => signal === 1 ? prices[index] : null);
    const sellSignals = mlSignals.map((signal, index) => signal === 0 ? prices[index] : null);

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Close Price',
                    data: prices,
                    borderColor: 'blue',
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: '50-Day MA',
                    data: ma50,
                    borderColor: 'orange',
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: '200-Day MA',
                    data: ma200,
                    borderColor: 'purple',
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Buy Signal',
                    data: buySignals,
                    borderColor: 'green',
                    backgroundColor: 'green',
                    pointStyle: 'triangle',
                    pointRadius: 8,
                    showLine: false
                },
                {
                    label: 'Sell Signal',
                    data: sellSignals,
                    borderColor: 'red',
                    backgroundColor: 'red',
                    pointStyle: 'rectRot',
                    pointRadius: 8,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 20
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Price'
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}
});
