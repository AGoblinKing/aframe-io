const { BrowserWindow, app, session } = require('electron')
const serve = require('electron-serve')
const electronDl = require('electron-dl')

const { greenhub } = require('../package.json')

electronDl({
	directory: `${process.cwd()}/offline/saves`,
	openFolderWhenDone: true,
})

const settings = require('./settings.js')

const dev = process.argv.join('|').indexOf('dev') !== -1

let win
const root = serve({ directory: 'public' })

// persist key/value store into a JSON file
function Settings(windowName) {
	let window, windowState

	function setBounds() {
		// Restore from appConfig
		if (settings.has(windowName)) {
			windowState = settings.get(windowName)
			return
		}
		// Default
		windowState = {
			x: undefined,
			y: undefined,
			width: 1000,
			height: 800,
		}
	}

	function saveState() {
		if (!windowState.isMaximized) {
			windowState = window.getBounds()
		}
		windowState.isMaximized = window.isMaximized()
		settings.set(windowName, windowState)
	}

	function track(win) {
		window = win
		;['resize', 'move', 'close'].forEach((event) => {
			win.on(event, saveState)
		})
	}

	setBounds()

	return {
		x: windowState.x,
		y: windowState.y,
		width: windowState.width,
		height: windowState.height,
		isMaximized: windowState.isMaximized,
		track,
	}
}

// prevent anything but scripts from the origin on not dev
function setupSession() {
	if (!dev) {
		session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
					'Content-Security-Policy': ["script-src 'self'"],
				},
			})
		})
	}
}

const state = {
	_v: 1,
	dev,
	native: true,
	offline: false,
}

function createWindow() {
	setupSession()

	root(win)

	const mainWindowStateKeeper = Settings('main')
	win = new BrowserWindow({
		backgroundColor: 'black',
		x: mainWindowStateKeeper.x,
		y: mainWindowStateKeeper.y,
		width: mainWindowStateKeeper.width,
		height: mainWindowStateKeeper.height,
		webPreferences: {
			nodeIntegration: false,
		},
		icon: 'build/icon.png',
	})

	win.setMenu(null)

	if (dev) {
		win.webContents.openDevTools({ detach: true, activate: false })
	}

	mainWindowStateKeeper.track(win)

	win.webContents.on('did-finish-load', () => {
		win.webContents.executeJavaScript(
			`window.state.settings.is(${JSON.stringify(state)});`
		)
	})

	console.log('greenhub is', greenhub)
	win.loadURL(dev ? greenhub.dev : greenhub.live)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow()
	}
})
