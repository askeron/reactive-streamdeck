'use strict';

const fs = require('fs')
const util = require('util')
const path = require('path')

const sharp = require('sharp')
const text2png = require('text2png')
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
		streamDeck.fillImage(index, await getIconBuffer(icon));
	} catch (error) {
		console.error("error while drawing icon: "+error)
		streamDeck.fillImage(index, {type: 'blank'});
	}
}

async function getIconBuffer(icon) {
	return (await getIconSharp(icon))
	    .flatten() // Eliminate alpha channel, if any.
	    .resize(streamDeck.ICON_SIZE, streamDeck.ICON_SIZE) // Scale up/down to the right size, cropping if necessary.
	    .raw() // Give us uncompressed RGB.
	    .toBuffer()
}

async function getIconSharp(icon) {
	if (icon.type === 'text') {
		const pngBuffer = await sharp(text2png(icon.text, {
			color: 'white',
			backgroundColor: 'black',
			padding: 14,
			lineSpacing: 6
		}))
		.resize(streamDeck.ICON_SIZE, streamDeck.ICON_SIZE, {fit: "contain"})
		.png()
		.toBuffer();
	
		// For some reason, adding an overlayWith command forces the final image to have
		// an alpha channel, even if we call .flatten().
		// To work around this, we have to overlay the image, render it as a PNG,
		// then put that PNG back into Sharp, flatten it, and render raw.
		// Seems like a bug in Sharp that we should make a test case for and report.
		return sharp(pngBuffer)
	} if (icon.type === 'image') {
		const filePath = path.resolve(__dirname, icon.relativePath)
		if (! await fileExists(filePath)) {
			throw new Error("iconimage not found: "+filePath)
		}
		return sharp(filePath)
	} if (icon.type === 'square') {
		return getSquareSharp(icon.color.r, icon.color.g, icon.color.b)
	} else {
		return getSquareSharp(0, 0, 0)
	}
}

function getSquareSharp(r,g,b){
	return sharp({
		create: {
			width: streamDeck.ICON_SIZE,
			height: streamDeck.ICON_SIZE,
			channels: 3,
			background: { r, g, b }
		}
		})
}

async function fileExists(filePath) {
	try {
		await (util.promisify(fs.access)(filePath, fs.constants.F_OK))
	} catch {
		return false
	}
	return true
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

setInterval(() => redraw(), 500)

module.exports = {
    addPage,
	changePage,
	//fadeIn,
	getCurrentPageName: (() => currentPage.name),
	MAX_KEYS: 32,
}

