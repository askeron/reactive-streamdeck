'use strict';

const fs = require('fs')
const util = require('util')
const path = require('path')

const sharp = require('sharp')
const text2png = require('text2png')

async function getIconBuffer(icon, iconsize) {
	return (await getIconSharp(icon, iconsize))
	    .flatten() // Eliminate alpha channel, if any.
	    .resize(iconsize, iconsize, {fit: "contain"}) // Scale up/down to the right size, cropping if necessary.
	    .raw() // Give us uncompressed RGB.
	    .toBuffer()
}

async function getIconSharp(icon, iconsize) {
	if (icon.type === 'text') {
		const pngBuffer = await sharp(text2png(icon.text, {
			color: 'white',
			backgroundColor: 'black',
			padding: 14,
			lineSpacing: 6
		}))
		.resize(iconsize, iconsize, {fit: "contain"})
		.png()
		.toBuffer();
	
		// For some reason, adding an overlayWith command forces the final image to have
		// an alpha channel, even if we call .flatten().
		// To work around this, we have to overlay the image, render it as a PNG,
		// then put that PNG back into Sharp, flatten it, and render raw.
		// Seems like a bug in Sharp that we should make a test case for and report.
		return sharp(pngBuffer)
	} if (icon.type === 'image') {
		const filePath = path.resolve(process.cwd(), icon.relativePath)
		if (! await fileExists(filePath)) {
			throw new Error("iconimage not found: "+filePath)
		}
		return sharp(filePath)
	} if (icon.type === 'square') {
		return getSquareSharp(icon.color.r, icon.color.g, icon.color.b, iconsize)
	} if (icon.type === 'blank') {
		return getSquareSharp(0, 0, 0, iconsize)
	} else {
		throw new Error("illegal icon type: "+icon.type)
	}
}

function getSquareSharp(r,g,b, iconsize){
	return sharp({
		create: {
			width: iconsize,
			height: iconsize,
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

module.exports = {
    getIconBuffer,
    getIconBufferBlank: (async (iconsize) => getIconBuffer({type: "blank"}, iconsize)),
}