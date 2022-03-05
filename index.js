'use strict';

const iconRenderer = require('./icon-renderer.js')

const StreamDeck = require('elgato-stream-deck')

function connectStreamDeck() {
	try {
		return StreamDeck.openStreamDeck()
	} catch (error) {
		console.error(error, error.stack)
		return null
	}
}

const streamDeck = connectStreamDeck()
const NUM_KEYS = streamDeck?.NUM_KEYS || 15
const ICON_SIZE = streamDeck?.ICON_SIZE || 72

const EventEmitter = require('events')
const eventEmitter = new EventEmitter()

const currentIcons = Array(NUM_KEYS).fill({})
const currentIconPngBuffers = Array(NUM_KEYS).fill(Buffer.from("", "utf-8"))
streamDeck?.clearAllKeys()

var webSocketServer

function setIcon(index, icon) {
	if (icon.type === "iconFunction") {
		setIcon(index, icon.iconFunction())
	} else if (JSON.stringify(icon) != JSON.stringify(currentIcons[index])) {
		currentIcons[index] = icon
		setIconInternal(index, icon).catch(reason => eventEmitter.emit('error', new Error("error while setting icon: "+reason)))
	}
}

async function setIconInternal(index, icon) {
	try {
		const iconBuffer = await iconRenderer.getIconRawBuffer(icon, ICON_SIZE)
		currentIconPngBuffers[index] = await (await iconRenderer.getIconSharp(icon, ICON_SIZE)).png().toBuffer()
		sendIconOverWebSocket(index)
		streamDeck?.fillImage(index, iconBuffer);
	} catch (error) {
        eventEmitter.emit('error', new Error("error while drawing icon: "+error))
		streamDeck?.fillImage(index, await iconRenderer.getIconBufferBlank(ICON_SIZE));
	}
}

function sendAllIconsOverWebSocket() {
	for (let i = 0; i < NUM_KEYS; i++) {
		sendIconOverWebSocket(i)
	}
}

function sendIconOverWebSocket(index) {
	sendMessageOverWebSocket({
		type: "icon",
		index,
		pngBase64: currentIconPngBuffers[index].toString('base64'), 
	})
}

function sendMessageOverWebSocket(messageObject) {
	const message = JSON.stringify(messageObject)
	webSocketServer.clients.forEach(webSocket => {
		try {
			webSocket.send(message)
		} catch(e) {
			console.error("error while sending to all clients via websocket", e)
		}
	})
}

streamDeck?.on('up', keyIndex => {
	onButtonUp(keyIndex)
});

streamDeck?.on('down', keyIndex => {
	onButtonDown(keyIndex)
});

function onButtonUp(keyIndex) {
	if (currentPage.buttons.length >= keyIndex) {
		const button = currentPage.buttons[keyIndex]
		if (button && button.hasOwnProperty("onUp")) {
			button.onUp()
		}
	}
}

function onButtonDown(keyIndex) {
	if (currentPage.buttons.length >= keyIndex) {
		const button = currentPage.buttons[keyIndex]
		if (button && button.hasOwnProperty("onClick")) {
			button.onClick()
		}
		if (button && button.hasOwnProperty("onDown")) {
			button.onDown()
		}
	}
}

streamDeck?.on('error', error => {
	eventEmitter.emit('error', error)
});

let currentPage = {
	name: undefined,
	buttons: [],
};

function showPage(page) {
	currentPage = page
	redraw()
}

function redraw() {
	for (let i = 0; i < NUM_KEYS; i++) {
		if (currentPage.buttons.length >= i+1) {
			const button = currentPage.buttons[i]
			if (button && button.hasOwnProperty("icon")) {
				setIcon(i,button.icon)
			} else {
				setIcon(i,{type:"blank"})
			}
		} else {
			setIcon(i,{type:"blank"})
		}
	}
}

function getKeyRowCount() {
	if (NUM_KEYS == 6) {
		return 2
	}
	if (NUM_KEYS == 15) {
		return 3
	}
	if (NUM_KEYS == 32) {
		return 4
	}
	throw "unknown streamdeck type"
}

function getKeyColumnCount() {
	if (NUM_KEYS == 6) {
		return 3
	}
	if (NUM_KEYS == 15) {
		return 5
	}
	if (NUM_KEYS == 32) {
		return 8
	}
	throw "unknown streamdeck type"
}

function setWebSocketServer(wss) {
	webSocketServer = wss
}

function registerExpressWebview(expressApp, webSocketServer) {
	require('./webview.js')({
        expressApp,
		simulateKeyDown: (keyIndex) => onButtonDown(keyIndex),
		simulateKeyUp: (keyIndex) => onButtonUp(keyIndex),
		getCurrentIconPngBuffer: (keyIndex) => currentIconPngBuffers[keyIndex],
		getKeyRowCount,
		getKeyColumnCount,
	})
	setWebSocketServer(webSocketServer)
	setInterval(() => {
		sendMessageOverWebSocket({
			type: "keepalive",
		})
	}, 20000)
	webSocketServer.on('connection', (webSocket) => {
		webSocket.on('message', (message) => {
			if (JSON.parse(message).type === "resend-all") {
				sendAllIconsOverWebSocket()
			}
		})
	})
}

setInterval(() => redraw(), 200)

const reactiveStreamdeck = {
	showPage,
    setBrightness: ((percentage) => streamDeck?.setBrightness(percentage)),
	unstableApiUseAtYourOwnRisk: {
		streamDeck,
	},
	NUM_KEYS: NUM_KEYS,
    MAX_KEYS: 32,
	onError: ((listener) => eventEmitter.on('error', listener)),
	registerExpressWebview,
}

const pages = {}
const pageStack = []
const pagedStreamDeck = {
	...reactiveStreamdeck,
	addToPageStack: (name) => {
		pageStack.push(name)
	},
	changePage: (name) => {
		pageStack.push(name)
		reactiveStreamdeck.showPage(pages[name])
	},
	getCurrentPageName: () => pageStack[pageStack.length-1],
	getPageNames: () => Object.keys(pages),
	addPage: page => pages[page.name] = page,
	goBackToLastPage: () => {
		pageStack.pop()
		pagedStreamDeck.changePage(pageStack.pop())
	},
}

reactiveStreamdeck.getPagedStreamdeck = () => pagedStreamDeck

module.exports = reactiveStreamdeck
