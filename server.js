const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca(); 
const WebSocket = require('ws');

const wss = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news");

wss.on('open', function() {
    console.log("Websocket connected!");

    
    const authMsg = {
        action: 'auth',
        key: process.env.APCA_API_KEY_ID,
        secret: process.env.APCA_API_SECRET_KEY
    };

    wss.send(JSON.stringify(authMsg));

 
    const subscribeMsg = {
        action: 'subscribe',
        news: ['*'] 
    };
    wss.send(JSON.stringify(subscribeMsg));
});

wss.on('message', async function(message) {
    console.log("Message is " + message);

    const currentEvent = JSON.parse(message)[0];
  
    if(currentEvent.T === "n") { 
        let companyImpact = 0;

        
        const apiRequestBody = {
            "model": "gpt-3.5-turbo",
            "messages": [
                { role: "system", content: "Only respond with a number from 1-100 detailing the impact of the headline." }, // How ChatGPT should talk to us
                { role: "user", content: "Given the headline '" + currentEvent.headline + "', show me a number from 1-100 detailing the impact of this headline."}
            ]
        }

        await fetch("http://127.0.0.1:5000/news-impact", { 
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                headline: currentEvent.headline
            })
        }).then(response => response.json())
        .then(data => {
            console.log(data);
            const score = data.score
            const sentiment = data.sentiment
            const companyImpact = parseFloat(score); 
            const companySentiment = sentiment.trim();
        }).catch(error => {
            console.error('Error:', error);
        });

        
        const tickerSymbol = currentEvent.symbols[0];

        
        if(companyImpact >= 70 && companySentiment === "positive") {
            
            let order = await alpaca.createOrder({
                symbol: tickerSymbol,
                qty: 1,
                side: 'buy',
                type: 'market',
                time_in_force: 'day' // day ends, it wont trade.
            });
        } else if (companyImpact >= 70 && companySentiment === "negative") { 
           
            let closedPosition = alpaca.closePosition(tickerSymbol);
        }
        
    }
});