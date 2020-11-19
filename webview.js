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
                    function updateImages() {
                        for (let i = 0; i < ${keyCount}; i++) {
                            document.getElementById("image"+i).src = "/getIcon?keyIndex="+i+"&time="+(new Date()/1);
                        }
                    }
                    function simulateClick(keyIndex) {
                        fetch('/click?keyIndex='+keyIndex)
                        setTimeout(updateImages, 200);
                        setTimeout(updateImages, 500);
                    }
                    updateImages()
                    setInterval(updateImages, 5000);
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