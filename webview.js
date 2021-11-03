'use strict';

module.exports = ({expressApp, getKeyRowCount, getKeyColumnCount, simulateKeyDown, simulateKeyUp, getCurrentIconPngBuffer}) => {
    expressApp.get('/', function(req, res, next){
        const rows = getKeyRowCount()
        const columns = getKeyColumnCount()
        const keyCount = rows * columns
        let iconHtml = ""
        for (let row = 0; row < rows; row++) {
            iconHtml += "<p>\n"
            for (let column = 0; column < columns; column++) {
                const i = row * columns + column
                iconHtml += `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NgYGD4DwABBAEAcCBlCwAAAABJRU5ErkJggg==" id="image${i}" onclick="simulateClick(${i})">\n`
            }
            iconHtml += "</p>\n"
        }
        res.send(`
        <html>
            <head>
                <style>
                    p {
                        text-align: center;
                    }
                    img {
                        padding: 3px 6px;
                    }
                </style>
            </head>
            <body style="background-color: black;">
                ${iconHtml}
                <script>
                const ws = new WebSocket("ws://"+window.location.host+"/");
                ws.onopen = function() {
                    console.log('WebSocket Client Connected')
                    ws.send('{"type": "resend-all"}')
                }
                ws.onmessage = function(e) {
                    const message = JSON.parse(e.data)
                    if (message.type === "icon") {
                        document.getElementById("image"+message.index).src = "data:image/png;base64,"+message.pngBase64
                    }
                }
                </script>
                <script>
                    function simulateClick(keyIndex) {
                        fetch('/click?keyIndex='+keyIndex)
                    }
                    updateImages()
                </script>
            </body>
        </html>
        `)
    });
    
    expressApp.get('/click', function(req, res, next) {
        const keyIndex = parseInt(req.query.keyIndex,10)
        simulateKeyDown(keyIndex)
        setTimeout(() => simulateKeyUp(keyIndex),50)
        
        res.send('OK')
    })
    
    expressApp.get('/getIcon', function(req, res, next) {
        const keyIndex = parseInt(req.query.keyIndex,10)
        const iconBuffer = getCurrentIconPngBuffer(keyIndex)
    
        res.writeHead(200, {
            'Content-Type': 'image/png'
        });
        res.end(iconBuffer); 
    })
}