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
		return await getTextSharp(icon, iconsize)
	} if (icon.type === 'image') {
		return await getImageSharp(icon, iconsize)
	} if (icon.type === 'square') {
		return await getSquareSharp(icon.color.r, icon.color.g, icon.color.b, iconsize)
	} if (icon.type === 'blank') {
		return await getSquareSharp(0, 0, 0, iconsize)
	} else {
		throw new Error("illegal icon type: "+icon.type)
	}
}

async function getTextSharp(icon, iconsize) {
	return await correctAlphaChannel(sharp(text2png(icon.text, {
		color: 'white',
		//backgroundColor: 'black',
		font: '20px sans-serif',
		padding: 14,
		lineSpacing: 6,
		textAlign: 'center'
	}))
	.resize(iconsize, iconsize, {fit: "contain"})
	)
}

async function correctAlphaChannel(sharpInstance) {
	// For some reason, adding an overlayWith command forces the final image to have
	// an alpha channel, even if we call .flatten().
	// To work around this, we have to overlay the image, render it as a PNG,
	// then put that PNG back into Sharp, flatten it, and render raw.
	// Seems like a bug in Sharp that we should make a test case for and report.
	return sharp(await (sharpInstance.png().toBuffer()))
}

async function getImageSharp(icon, iconsize) {
	const filePath = path.resolve(process.cwd(), icon.relativePath)
	if (! await fileExists(filePath)) {
		throw new Error("iconimage not found: "+filePath)
	}
	let result = sharp(filePath)
	if ('labels' in icon) {
		result = result
			.resize(iconsize, iconsize, {fit: "contain"})
			.composite(await Promise.all(icon.labels.map(async (label) => {
				const top = Math.round(label.position.top * iconsize)
				const left = Math.round(label.position.left * iconsize)
				const bottom = Math.round(label.position.bottom * iconsize)
				const right = Math.round(label.position.right * iconsize)
				const width = right - left
				const height = bottom - top
				const fullTransparentColor = {r:0,g:0,b:0,alpha:0}
				const textPngBuffer = await(sharp(text2png(label.text, {
						color: 'white',
						//backgroundColor: 'black',
						font: '30px sans-serif',
						padding: 0,
						lineSpacing: 6,
						textAlign: 'center'
					}))
					.resize(width, height, {
						fit: "contain",
						background: fullTransparentColor,
					})
					.png()
					.toBuffer()
				)
				return { input: textPngBuffer, top, left }
			})))
		result = await correctAlphaChannel(result)
	}
	return result
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