const ws = require('ws')
class db {
    constructor(ws, auth) {
        if (!ws) throw new Error('Missing websocket address')
        this.ws = ws
        this.auth = auth
        this.lastPing = null
        this.lastPingTime = null
        this.currentPing = 0
        this.attempts = 0
        this.app = this.makeWS()
        this.que = []
    }
    send(type, data, callback) {
        let _id = callback ? `${new Date().getTime()}${Math.floor(Math.random() * 1000)}` : null
        if (callback) this.que.push({ type, data, _id, callback })
        this.app.sendData({ type, data, _id })
    }
    handle = (type, data) => {
        return new Promise((res, rej) => {
            if (!type) return rej('Invalid Type')
            let fallback = setTimeout(() => rej('Timeout'), 30000)
            this.send(type, data, (err, data) => {
                clearTimeout(fallback)
                if (err) return rej(err)
                return res(data)
            })
        })
    }
    save(data) {
        return new Promise((res, rej) => {
            this.handle('save', data).then(r => res(r)).catch(e => rej(e))
        })
    }
    find(query) {
        return new Promise((res, rej) => {
            this.handle('find', query).then(r => res(r)).catch(e => rej(e))
        })
    }
    findAll(query) {
        return new Promise((res, rej) => {
            this.handle('findAll', query).then(r => res(r)).catch(e => rej(e))
        })
    }
    delete(_id) {
        return new Promise((res, rej) => {
            this.handle('delete', { _id }).then(r => res(r)).catch(e => rej(e))
        })
    }
    deleteOne(query) {
        return new Promise((res, rej) => {
            this.handle('deleteOne', query).then(r => res(r)).catch(e => rej(e))
        })
    }
    deleteMany(query) {
        return new Promise((res, rej) => {
            this.handle('deleteMany', query).then(r => res(r)).catch(e => rej(e))
        })
    }
    waitForSocketConnection = (socket, callback, data, timer = 1000, rounds = 0) => {
        clearTimeout((this.socketWait))
        if (!callback || typeof callback !== 'function' || rounds > 10) return
        if (socket.readyState === 0) {
            setTimeout(() => { this.waitForSocketConnection(socket, callback, data, timer, rounds) }, timer * rounds)
        } else if (socket.readyState === 1) {
            callback(data)
        } else {
            this.waitForSocketConnection(socket, callback, data, timer, rounds)
        }
    }
    waitForAuth = (socket, callback, data, timer = 1000, rounds = 0) => {
        clearTimeout((this.socketWaitForAuth))
        if (!callback || typeof callback !== 'function' || rounds > 10) return
        if (!this.authenticated) {
            setTimeout(() => { this.waitForAuth(socket, callback, data, timer) }, timer, rounds + 1)
        } else {
            callback(data)
        }
    }
    makeWS() {
        clearInterval(this.pingcheck)
        let server = new ws(this.ws, {
            rejectUnauthorized: false,
            strictSSL: false
        })
        server.sendData = data => {
            if (!this.authenticated && data.type !== 'auth') {
                this.waitForAuth(this.app, data => { this.app.send(JSON.stringify(data)) }, data)
            } else if (this.app.readyState !== 1) {
                this.waitForSocketConnection(this.app, data => { this.app.send(JSON.stringify(data)) }, data)
            } else {
                this.app.send(JSON.stringify(data))
            }
        }
        server.on('error', (e) => {
            if (!/Unexpected server response/.test(e)) {
                console.log(e)
                this.attempts++
                clearTimeout(this.attempter)
                this.attempter = setTimeout(() => {
                    this.app = this.makeWS()
                }, this.attempts * 1000 * 10)
            }
        })
        server.on('open', () => {
            this.waitForAuth(server, () => this.sendPing())
            this.waitForSocketConnection(server, (data) => server.send(data), JSON.stringify({ type: 'auth', data: { auth: this.auth } }), 10)
            this.pingcheck = setInterval(() => this.sendPing(), 10000)
        })
        server.on('close', (e) => {
            this.server = false
            clearTimeout(this.attempter)
            this.attempter = setTimeout(() => {
                this.app = this.makeWS()
            }, this.attempts * 1000 * 10)
        })
        server.on('message', async (message) => {
            let that
            try {
                that = JSON.parse(message)
            } catch (e) {
                return console.log(`RECEIVED DATA: ${message}`)
            }
            let { data, type, _id } = that
            let request
            if (_id) {
                for (let i = 0; i < this.que.length; i++) {
                    if (this.que[i]._id === _id) {
                        request = this.que.splice(i, 1)[0]
                        i = Infinity
                    }
                }
            }
            switch (type) {
                case 'error': {
                    if (request && typeof request.callback === 'function') request.callback(that.message, null)
                    break
                }
                case 'response': {
                    if (request && typeof request.callback === 'function') request.callback(null, data)
                    break
                }
                case 'ping': {
                    if (this.lastPing !== data) {
                        this.sendPing()
                    } else {
                        this.currentPing = new Date().getTime() - this.lastPingTime
                    }
                    break
                }
                case 'auth': {
                    if (!data && typeof that.error !== 'boolean' && that.error !== false) {
                        let auth = {}
                        auth[this.username] = this.password
                        server.send(JSON.stringify({ type: 'auth', data: auth }))
                        this.server = false
                        this.authenticated = false
                    } else {
                        this.authenticated = true
                        this.server = true
                    }
                    break
                }
                default: { return }
            }
        })
        return server
    }
    sendPing() {
        this.lastPing = Math.floor(Math.random() * 10000)
        this.lastPingTime = new Date().getTime()
        this.send('ping', this.lastPing)
    }
}
class Data {
    constructor(props) {
        let t = new Date()
        this._id = `${t.getFullYear()}${Math.round(Math.random() * 10000)}${t.getUTCDay().toString()}${t.getUTCHours().toString()}${t.getUTCMinutes().toString()}${t.getUTCMilliseconds()}`
        if (props && typeof props === 'object') {
            Object.entries(props).forEach(([key, value]) => {
                this[key] = value
            })
        }
        if (!this._t) {
            this._t = t
        } else {
            this._u = t
        }
    }
}
const isPromise = (p) => typeof p === 'object' && typeof p.then === 'function'
const returnsPromise = (f) => f.constructor.name === 'AsyncFunction' || m(typeof f === 'function' && isPromise(f()))
class Model extends Data {
    constructor(props, name, validator) {
        super(props, name, validator)
        if (typeof validator === 'function') {
            if (returnsPromise(validator)) {
                throw new Error('Model validator must be synchronous.')
            } else {
                props = validator(props)
                if (props && typeof props === 'object') Object.entries(props).forEach(([key, value]) => this[key] = value)
            }
        }
        this._m = name
    }
}
const construct = (model, data) => model(data)
const buildModel = (name, validator) => data => construct(data => returnsPromise(validator) ? new Promise(async (res) => {
    let d = await validator(data)
    let model = new Model(d || data, name)
    return res(model)
  }) : new Model(data, name, validator), data)
function makeModel(database, name, validator) {
    class ModelClass {
        constructor(data) {
            this.name = name
            this.validator = validator
            this.model = buildModel(this.name, this.validator)
            if (data) this._doc = this.model(data)
        }
        send(type, data) {
            return new Promise((res, rej) => {
                database.handle(type, data).then(result => {
                    res(result)
                }).catch(e => rej(e))
            })
        }
        save(data) {
            return new Promise((res, rej) => {
                if (!data && isPromise(this._doc)) {
                    this._doc.then(data => {
                        this.send('save', data ? { ...data, _m: this.name } : this._doc).then(r => res(r)).catch(e => rej(e))
                    })
                } else {
                    this.send('save', data ? { ...data, _m: this.name } : this._doc).then(r => res(r)).catch(e => rej(e))
                }
            })
        }
        find(query) {
            return new Promise((res, rej) => {
                this.send('find', { ...query, _m: this.name }).then(r => res(r)).catch(e => rej(e))
            })
        }
        findAll(query) {
            return new Promise((res, rej) => {
                this.send('findAll', { ...query, _m: this.name }).then(r => res(r)).catch(e => rej(e))
            })
        }
        delete(_id) {
            return new Promise((res, rej) => {
                this.send('delete', { _id }).then(r => res(r)).catch(e => rej(e))
            })
        }
        deleteOne(query) {
            return new Promise((res, rej) => {
                this.send('deleteOne', { ...query, _m: this.name }).then(r => res(r)).catch(e => rej(e))
            })
        }
        deleteMany(query) {
            return new Promise((res, rej) => {
                this.send('deleteMany', { ...query, _m: this.name }).then(r => res(r)).catch(e => rej(e))
            })
        }
    }
    return ModelClass
}
const makeModels = (database, models) => {
    return models.map(u => ({ name: u.name, model: makeModel(database, u.name, u.validator) })).reduce((a, b) => {
        a[b.name] = b.model
        return a
    }, {})
}
module.exports = { makeModels, makeModel, db, Data, Model }