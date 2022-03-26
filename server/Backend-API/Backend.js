const ws = require('ws')
const filter = (data, filters) => {
    if (!data) return []
    var filterType = ''
    var filterField = ''
    var filterCount = Infinity
    var filterMode = null
    let filter = (u, i) => {
        let { name, value, compare } = filterMode
        if (compare && typeof value === 'object' && value instanceof Array) {
            let r = []
            let fm = filterMode, ft = filterType, ff = filterField, fc = filterCount;
            for (let z = 0; z < value.length; z++) {
                let { name, type, mode, count } = value[i]
                if (!name) continue
                filterMode = mode
                filterType = type
                filterField = name
                filterCount = count || Infinity
                r.push(filter(u))
            }
            filterMode = fm
            filterType = ft
            filterField = ff
            filterCount = fc
            if (compare === 'not') {
                return r.length > 0 && r.filter(u => u).length === 0
            } else if (compare === 'or') {
                return r.filter(u => u).length > 0
            } else {
                return r.filter(u => u).length === value.length
            }
        } else {
            if (!u || (!u[filterField] && u[filterField] === 0)) return false
            if (i > filterCount) return false
            const data = u[filterField]
            switch (filterType) {
                case 'number': {
                    switch (name) {
                        case 'gt': {
                            return data > value
                        }
                        case 'lt': {
                            return data < value
                        }
                        case 'gte': {
                            return data >= value
                        }
                        case 'lte': {
                            return data <= value
                        }
                        case 'equal': {
                            return data === value
                        }
                        case 'exists': return ((data && value) || value && data)
                        default: {
                            return data
                        }
                    }
                }
                case 'string': {
                    switch (name) {
                        case 'equal': {
                            return value === data
                        }
                        case 'matches': {
                            return data && value && data.toLowerCase().match(value.toLowerCase())
                        }
                        case 'contains': {
                            return data && value && data.toLowerCase().includes(value.toLowerCase())
                        }
                        case 'notcontain': {
                            return data && value && !data.toLowerCase().includes(value.toLowerCase())
                        }
                        case 'notequal': {
                            return value !== data
                        }
                        case 'lengthgte': {
                            return data && value <= data.length
                        }
                        case 'lengthlte': {
                            return data && value >= data.length
                        }
                        case 'lengtheq': {
                            return data && value === data.length
                        }
                        case 'lengthlt': {
                            return data && value > data.length
                        }
                        case 'lengthgt': {
                            return data && value < data.length
                        }
                        case 'exists': {
                            return ((data && value) || (!data && !value))
                        }
                        case 'in': {
                            return value.includes(data) ? true : false
                        }
                        case 'notin': {
                            return !value.includes(data) ? true : false
                        }
                        default: {
                            return data
                        }
                    }
                }
                case 'array': {
                    switch (name) {
                        case 'includes': {
                            return data.includes(value)
                        }
                        case 'notincludes': {
                            return !data.includes(value)
                        }
                        case 'in': {
                            return data.find(u => value.includes(u)) ? true : false
                        }
                        case 'notin': {
                            return !data.find(u => value.includes(u)) ? true : false
                        }
                        case 'exists': return ((data && value) || value && data)
                        default: {
                            return data
                        }
                    }
                }
                case 'object': {
                    switch (name) {
                        case 'has': {
                            return value in data
                        }
                        case 'exists': return ((data && value) || value && data)
                        default: {
                            return data
                        }
                    }
                }
                case 'date': {
                    switch (name) {
                        case 'gt': {
                            return data && new Date(data).getTime() > new Date(value).getTime()
                        }
                        case 'lt': {
                            return data && new Date(data).getTime() < new Date(value).getTime()
                        }
                        case 'gte': {
                            return data && new Date(data).getTime() >= new Date(value).getTime()
                        }
                        case 'lte': {
                            return data && new Date(data).getTime() <= new Date(value).getTime()
                        }
                        case 'hasPast': {
                            return new Date(data).getTime() >= new Date().getTime()
                        }
                        case 'hasNotPassed': {
                            return data && new Date(data).getTime() <= new Date().getTime()
                        }
                        case 'between': {
                            return data && filterMode['a'] && filterMode['b'] && new Date(data).getTime() - new Date(filterMode['a']).getTime() > 0 && new Date(data).getTime() - new Date(filterMode['b']).getTime() < 0
                        }
                        case 'exists': {
                            return value === !isNaN(Date.parse(data))
                        }
                        default: {
                            return data
                        }
                    }
                }
                default: {
                    return data
                }
            }
        }
    }
    for (let i = 0; i < filters.length; i++) {
        if (!filters[i]) continue
        let { name, type, mode, count } = filters[i]
        if (!name) continue
        filterMode = mode
        filterType = type
        filterField = name
        filterCount = count || Infinity
        data = data.filter(filter)
    }
    return data
}
const sort = (data, fields) => {
    let sfs = fields
    if (!data) return []
    var sortType = ''
    var sortField = ''
    var sortDirection = false
    let sort = (a, b) => {
        if (!a[sortField] && !b[sortField]) {
            if (!a && !b) return 0
            if (a && !b) return 1
            if (b && !a) return -1
            switch (sortType) {
                case 'date': {
                    return new Date(a).getTime() - new Date(b).getTime()
                }
                case 'array' || 'object': {
                    if (a instanceof Array || b instanceof Array) {
                        return a.length - b.length
                    } else {
                        return Object.keys(a)?.length - Object.keys(b?.length)
                    }
                }
                case 'number': {
                    return a - b
                }
                case 'string': {
                    return (typeof a.toLowerCase === 'function' ? a.toLowerCase() : a) < (typeof b.toLowerCase === 'function' ? b.toLowerCase() : b) ? -1 : (typeof a.toLowerCase === 'function' ? a.toLowerCase() : a) === (typeof b.toLowerCase === 'function' ? b.toLowerCase() : b) ? 0 : 1
                }
                default: {
                    return a < b ? -1 : a === b ? 0 : 1
                }
            }
        } else {
            if (a[sortField] && !b[sortField]) return 1
            if (b[sortField] && !a[sortField]) return -1
            switch (sortType) {
                case 'date': {
                    if (!isNaN(Date.parse(a[sortField])) && isNaN(Date.parse(b[sortField]))) return 1
                    if (isNaN(Date.parse(a[sortField])) && !isNaN(Date.parse(b[sortField]))) return -1
                    return new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime()
                }
                case 'array' || 'object': {
                    if (a[sortField] instanceof Array || b[sortField] instanceof Array) {
                        return a[sortField].length - b[sortField].length
                    } else {
                        return Object.keys(a[sortField])?.length - Object.keys(b[sortField]?.length)
                    }
                }
                case 'number': {
                    return a[sortField] - b[sortField]
                }
                case 'string': {
                    return a[sortField].toLowerCase() < b[sortField].toLowerCase() ? -1 : a[sortField].toLowerCase() === b[sortField].toLowerCase() ? 0 : 1
                }
                default: {
                    return a[sortField] < b[sortField] ? -1 : a[sortField] === b[sortField] ? 0 : 1
                }
            }
        }
    }
    for (let i = sfs.length - 1; i >= 0; i--) {
        let sf = sfs[i]
        if (!sf) continue
        sortDirection = sf.direction
        sortField = sf.name
        sortType = sf.type
        if (sortType === 'array') {
            let c = false
            let s = sortType
            for (let z = 0; z < data.length; z++) if (data[z][sortField]) {
                c = true
                sortType = typeof data[z][sortField]
                z = data.length
            }
            if (c) {
                data = data.map(u => {
                    u[sortField] = u[sortField].sort(sort)
                    return u
                })
                sortType = s
            }
        }
        data = sortDirection ? data.sort(sort).reverse() : data.sort(sort)
    }
    return data
}
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
            console.log('Database Connection Closed, Authorized: false')
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
                        console.log(`Database Current Ping: ${this.currentPing}ms, Authorized: ${this.server}`)
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
                        console.log('Database connected with auth')
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
const returnsPromise = (f) => f && (f.constructor.name === 'AsyncFunction' || (typeof f === 'function' && typeof f === 'object' && typeof f.then === 'function'))
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
const constructModel = (model, data) => model(data)
const buildModel = (name, validator) => data => constructModel(data => returnsPromise(validator) ? new Promise(async (res) => {
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
        filter = filter
        sort = sort
        find(query) {
            return new Promise((res, rej) => {
                this.send('find', { ...query, _m: this.name }).then(r => res(r)).catch(e => rej(e))
            })
        }
        findAll(query, options) {
            return new Promise((res, rej) => {
                this.send('findAll', { ...query, _m: this.name }).then(r => {
                    if (options && typeof options.filter === 'object') r = this.filter(r, options.filter instanceof Array ? options.filter : [options.filter])
                    if (options && typeof options.sort === 'object') r = this.sort(r, options.sort instanceof Array ? options.sort : [options.sort])
                    res(r)
                }).catch(e => rej(e))
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

const construct = (model, data) => {
    return new Promise(async (res, rej) => {
        try {
            let d = new model(data)
            if (isPromise(d._doc)) {
                d._doc.then(() => res(d))
            } else {
                res(d)
            }
        } catch (e) {
            rej(e)
        }
    })
}
module.exports = { makeModels, makeModel, db, Data, Model, construct }