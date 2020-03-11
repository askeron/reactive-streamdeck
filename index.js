'use strict';

const iconRenderer = require('./icon-renderer.js')

const StreamDeck = require('elgato-stream-deck')
const streamDeck = StreamDeck.openStreamDeck()

const pages = [];

const currentIcons = new Array(streamDeck.NUM_KEYS).map(x => {type:'blank'})
streamDeck.clearAllKeys()

function setIcon(index, icon) {
	if (icon.type === "iconFunction") {
		setIcon(index, icon.iconFunction())
	} else if (JSON.stringify(icon) != JSON.stringify(currentIcons[index])) {
		currentIcons[index] = icon
		setIconInternal(index, icon).catch(reason => console.error("error: "+reason))
	}
}

async function setIconInternal(index, icon) {
	try {
		streamDeck.fillImage(index, await iconRenderer.getIconBuffer(icon, streamDeck.ICON_SIZE));
	} catch (error) {
		console.error("error while drawing icon: "+error)
		streamDeck.fillImage(index, await iconRenderer.getIconBufferBlank(streamDeck.ICON_SIZE));
	}
}

streamDeck.on('up', async keyIndex => {
	if (currentPage.buttons.length >= keyIndex) {
		const button = currentPage.buttons[keyIndex]
		if (button && button.hasOwnProperty("onUp")) {
			button.onUp()
		}
	}
});

streamDeck.on('down', keyIndex => {
	if (currentPage.buttons.length >= keyIndex) {
		const button = currentPage.buttons[keyIndex]
		if (button && button.hasOwnProperty("onClick")) {
			button.onClick()
		}
		if (button && button.hasOwnProperty("onDown")) {
			button.onDown()
		}
	}
});

streamDeck.on('error', error => {
	console.error("streamdeck error: "+error);
});

let currentPage = {
	name: undefined,
	buttons: [],
};

function changePage(pageName) {
	const pagesFiltered = pages.filter(x => x.name === pageName)
	if (pagesFiltered.length === 0) {
		throw new Error(`no page with name '${pageName}' found`)
	}
	currentPage = pagesFiltered[0]
	redraw()
}

function redraw() {
	for (let i = 0; i < streamDeck.NUM_KEYS; i++) {
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

function fadeIn() {
	for (let i = 0; i <= 100; i+=1) {
		setTimeout(function(percentage){
			streamDeck.setBrightness(percentage);
		},i*40,i);
	}
}

function addPage(page) {
	for (let x of pages) {
		if (x.name === page.name) {
			throw new Error(`could not add page because of duplicated name '${page.name}'`)
		}
	}
	pages.push(page)
}

setInterval(() => redraw(), 200)

module.exports = {
    addPage,
	changePage,
	//fadeIn,
    getCurrentPageName: (() => currentPage.name),
    setBrightness: ((percentage) => streamDeck.setBrightness(percentage)),
	unofficialApiUseAtYourOwnRisk: {
        streamDeck
    },
	MAX_KEYS: 32,
}

