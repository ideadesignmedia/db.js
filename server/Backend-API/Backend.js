const ws = require('ws')
//TODO: ADD THE WAIT FOR CONNECTION LOGIC TO PREVENT SEND BEFORE OPEN ERROR
class DatabaseConnection {
    constructor(ws, username, password) {
        if (!ws) throw new Error('Missing websocket address')
        this.ws = ws
        this.username = username
        this.password = password
        this.lastPing = null
        this.lastPingTime = null
        this.currentPing = 0
        this.attempts = 0
        this.app = this.makeWS()
        this.que = []
    }
    send(type, data, callback) {
        if (callback) {
            let _id = `${new Date().getTime()}${Math.floor(Math.random() * 1000)}`
            this.que.push({ type, data, _id, callback })
        }
        this.app.send(JSON.stringify({ type, data }))
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
    makeWS() {
        clearInterval(this.pingcheck)
        let server = new ws(this.ws, {
            rejectUnauthorized: false,
            strictSSL: false
        })
        server.on('error', (e) => {
            if (!/Unexpected server response/.test(e)) {
                console.log(e)
                this.error(e)
                this.attempts++
                clearTimeout(this.attempter)
                this.attempter = setTimeout(() => {
                    this.app = this.makeWS()
                }, this.attempts * 1000 * 10)
            }
        })
        server.on('open', () => {
            let auth = {}
            auth[this.username] = this.password
            this.sendPing()
            server.send(JSON.stringify({ type: 'auth', data: auth }))
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
                    } else {
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
class Model extends Data {
    constructor(props, name, validation) {
        super(props, name, validation)
        if (typeof validation === 'function') validation(props)
        this._m = name
    }
}
function construct(model, data) {
    return model(data)
}
const buildModel = (name, validation) => data => construct(data => {
    return new Model(data, name, validation)
}, data)
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
                this.send('save', data ? { ...data, _m: this.name } : this._doc).then(r => res(r)).catch(e => rej(e))
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
module.exports = { makeModels, makeModel, DatabaseConnection, Data, Model }