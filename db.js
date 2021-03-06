const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const DBPATH = process.env.DBPATH || './database'
const DBDEFAULT = path.resolve(path.join(DBPATH, 'data'))
const checkType = (type, value) => {
    switch (type) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number';
        case 'boolean':
            return typeof value === 'boolean';
        case 'array':
            return Array.isArray(value);
        case 'object':
            return typeof value === 'object';
        case 'date':
            return value instanceof Date;
        default:
            return false;
    }
}
const validateObjectTypes = (obj, schema) => {
    const entries = Object.entries(schema);
    const objKeys = Object.keys(obj);
    const objValues = Object.values(obj);
    let isValid = true;
    let reason = { key: '', value: '', message: '' }
    for (let i = 0; i < objKeys.length; i++) {
        if (typeof objValues[i] === 'undefined') continue
        if (!isValid) break;
        let entry = entries.find(([key]) => key === objKeys[i]);
        if (entry) {
            let validateArray = (scheme, value) => {
                let isValid = true;
                let reason = { key: '', value: '', message: '' }
                if (scheme.length < 1) {
                    throw new Error('Schema array must have at least one type')
                } else if (!(value instanceof Array)) {
                    isValid = false
                    reason.message = 'Value is not an array'
                    reason.key = objKeys[i]
                    reason.value = value
                } else if (value.length < 1) {
                    return true
                } else if (scheme.length === 1) {
                    let type = scheme[0];
                    if (typeof type === 'object') {
                        if (type instanceof Array) {
                            let isSolid = true
                            for (let i = 0; i < value.length; i++) {
                                isSolid = validateArray(type, value[i])                                
                                if (!isSolid || typeof isSolid === 'object') {
                                    isValid = false
                                    reason.message = `Value at index ${i} ${JSON.stringify(value[i])} is not a valid array of type ${JSON.stringify(type)}`
                                    reason.key = objKeys[i]
                                    reason.value = value
                                    break
                                }
                            }
                        } else {
                            let isSolid = true
                            for (let j = 0; j < value.length; j++) {
                                isSolid = validateObjectTypes(value, type);
                                if (!isSolid || typeof isSolid === 'object') {
                                    isValid = false;
                                    reason = isSolid;
                                    break
                                }
                            }
                        }
                    }
                } else {
                    let types = scheme;
                    for (let j = 0; j < types.length; j++) {
                        isValid = checkType(types[j], value[z])
                        if (!isValid) {
                            reason.message = `Value at index ${z} ${JSON.stringify(value)} is not of types ${types[j]}`
                            reason.key = objKeys[i]
                            reason.value = value
                            break
                        }
                    }
                }
                return isValid || reason
            }
            if (typeof entry[1] === 'string') {
                let isSolid = checkType(entry[1], objValues[i]);
                if (!isSolid) {
                    isValid = false;
                    reason.key = objKeys[i];
                    reason.value = objValues[i];
                    reason.message = `${objKeys[i]} is not a ${entry[1]}`;
                }
            } else if (typeof entry[1] === 'object') {
                if (entry[1] instanceof Array) {
                    if (entry[1].length < 1) {
                        isValid = false;
                        reason.key = objKeys[i];
                        reason.value = objValues[i];
                        reason.message = 'Invalid schema, contains an empty array';
                    } else if (entry[1].length === 1) {
                        let type = entry[1][0];
                        if (typeof type === 'object') {
                            if (type instanceof Array) {
                                //Add validateArray(type, objValue[i])
                                throw new Error('Cannot nest arrays in schema')
                            } else {
                                for (let z = 0; z < objValues[i].length; z++) {
                                    let isSolid = validateObjectTypes(objValues[i][z], type);
                                    if (!isSolid || typeof isSolid === 'object') {
                                        isValid = false;
                                        reason.key = objKeys[i];
                                        reason.value = objValues[i][z];
                                        reason.message = `${objKeys[i]} ${JSON.stringify(objValues[i][z])} is not a ${JSON.stringify(type)}: ${JSON.stringify(isSolid)}`;
                                    }
                                    if (!isValid) break;
                                }
                            }
                        } else {
                            let isSolid = true
                            for (let z = 0; z < objValues[i].length; z++) {
                                isSolid = checkType(type, objValues[i][z]);
                                if (!isSolid) break;
                            }
                            if (!isSolid) {
                                isValid = false;
                                reason.key = objKeys[i];
                                reason.value = objValues[i];
                                reason.message = `${objKeys[i]} must be an array of ${JSON.stringify(type)}`;
                            }
                        }
                    } else {
                        let isSolid = false
                        for (let z = 0; z < entry[1].length; z++) {
                            isSolid = checkType(entry[1][z], objValues[i]);
                            if (isSolid) break;
                        }
                        if (!isSolid) {
                            reason = { key: objKeys[i], value: objValues[i], message: 'value does not match any available types' }
                            isValid = false;
                        }
                    }
                } else {
                    let isSolid = validateObjectTypes(objValues[i], entry[1]);
                    if (!isSolid || typeof isSolid === 'object') {
                        reason = { key: objKeys[i], value: objValues[i], message: 'Invalid object type: ' + JSON.stringify(isSolid) }
                        isValid = false;
                    }
                }
            } else {
                isValid = false
                reason = { key: objKeys[i], value: objValues[i], message: 'Invalid schema: ' + typeof entry[1] }
            }
        }
    }
    return isValid || reason;
}
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
                        case 'in': {
                            return value.includes(data)
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
                            return value.includes(data)
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
                        return Object.keys(a).length - Object.keys(b).length
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
                        return Object.keys(a[sortField]).length - Object.keys(b[sortField].length)
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
class db {
    constructor(db, key, buffer) {
        this.db = db
        this.algorithm = 'aes-256-ctr';
        if (key) {
            this.encrypted = true;
            if (key.length !== 32) throw new Error('Invalid key length, must be 32')
            this.key = key;
            if (buffer) {
                if (buffer.length !== 16) throw new Error('Invalid buffer length must be 16')
                this.buffer = buffer
            } else {
                this.buffer = '1234567891011121'
            }
        }
        this.init(this.db)
    }
    encrypt = string => {
        let cipher = crypto.createCipheriv(this.algorithm, this.key, this.buffer);
        let encrypted = Buffer.concat([cipher.update(string), cipher.final()]);
        return encrypted.toString('hex')
    }
    decrypt = string => {
        let decipher = crypto.createDecipheriv(this.algorithm, this.key, this.buffer);
        let decrpyted = Buffer.concat([decipher.update(Buffer.from(string, 'hex')), decipher.final()]);
        return decrpyted.toString();
    }
    init = db => {
        let dbTime = new Date()
        if (db) this.DB = path.resolve(path.join(DBPATH, db))
        if (!fs.existsSync(DBPATH)) { console.log('CREATING DATABASE DIRECTORY'); fs.mkdirSync(DBPATH) }
        if (!fs.existsSync(this.DB || DBDEFAULT)) {
            fs.writeFileSync(this.DB || DBDEFAULT, this.encrypted ? this.encrypt(JSON.stringify([])) : JSON.stringify([]))
            this.data = []
            console.log('NEW DATABASE DATA', (new Date() - (dbTime)))
        } else {
            console.log('READING DATABASE')
            this.data = JSON.parse(this.encrypted ? this.decrypt(fs.readFileSync(this.DB || DBDEFAULT, { encoding: 'utf-8' })) : fs.readFileSync(this.DB || DBDEFAULT, { encoding: 'utf-8' }))
            console.log('DATABASE LOADED', (new Date() - (dbTime)))
        }
    }
    compare = (a, b) => {
        if ((a && !b) || (b && !a) || (typeof a !== typeof b && (typeof a !== 'function' && typeof b !== 'function'))) return false
        if (typeof a.getTime === 'function') {
            if (a.getTime() !== b.getTime()) return false
            return true
        } else if (typeof a === 'function' || typeof b === 'function') {
            if (typeof a === 'function') {
                return a(b)
            } else {
                return b(a)
            }
        } else if (typeof a === 'object') {
            if (Array.isArray(a)) {
                if (a.length !== b.length) return false
                for (let i = 0; i < a.length; i++) {
                    let j = false
                    for (let o = 0; o < b.length; o++) {
                        if (this.compare(a[i], b[o])) {
                            j = true
                            o = b.length
                        }
                    }
                    if (j === false) return false
                }
                return true
            } else {
                let c = Object.entries(a)
                let d = Object.entries(b)
                if (c.length !== d.length) return false
                for (let i = 0; i < c.length; i++) {
                    let j = false
                    for (let o = 0; o < d.length; o++) {
                        if (this.compare(c[i], d[o])) {
                            j = true
                            o = d.length
                        }
                    }
                    if (j === false) return false
                }
                return true
            }
        }
        if (a !== b) return false
        return true
    }
    readRecord = place => {
        return new Promise((res, rej) => {
            if (typeof place !== 'string') return rej('RECORD ADDRESS NOT OF TYPE STRING')
            try {
                res(JSON.parse(fs.readFileSync(place)))
            } catch (e) {
                return rej(`Failed to read ${place}: ${e}`)
            }
        })
    }
    find = obj => {
        return new Promise(async (res, rej) => {
            if (!obj || typeof obj !== 'object') {
                if (typeof obj === 'function') {
                    for (let i = 0; i < this.data.length; i++) if (obj(this.data[i])) return res(this.data[i])
                    return res(null)
                } else {
                    return rej(`BAD QUERY: ${JSON.stringify(obj)}`)
                }
            }
            let id = obj._id || null
            let find = async d => {
                if (d.length > 1) {
                    for (let i = 0; i < this.data.length; i++) {
                        let count = 0
                        for (let z = 0; z < d.length; z++) {
                            if (!this.data[i][d[z][0]]) { continue }
                            if (!this.compare(this.data[i][d[z][0]], d[z][1])) { continue } else { count++ }
                        }
                        if (count === d.length) return this.data[i]
                    }
                } else {
                    if (!d) return rej('EMPTY QUERY')
                    for (let i = 0; i < this.data.length; i++) {
                        if (this.data[i][d[0][0]] && this.compare(this.data[i][d[0][0]], d[0][1])) return this.data[i]
                    }
                }
                return res(null)
            }
            let complete
            if (id) {
                complete = await find([['_id', id]])
            } else {
                complete = await find(Object.entries(obj))
            }
            if (complete && complete._recordData) complete.data = await this.readRecord(complete._recordData).catch(e => {
                console.log(e)
                complete._recordData = null
                this.save(complete).then((result) => {
                    return res(result)
                }).catch(e => {
                    console.log(e)
                    this.delete(complete._id).then(() => {
                        this.save().then(() => {
                            return rej('RECORD CORRUPTED. REMOVED.')
                        }).catch(e => {
                            console.log(e)
                            return rej('RECORD CORRUPTED.')
                        })
                    }).catch(e => {
                        console.log(e)
                        return rej('RECORD CORRUPTED. FAILED TO REMOVE')
                    })
                })
            })
            return res(complete)
        })
    }
    simpFind = obj => {
        return new Promise(async (res, rej) => {
            if (!obj || typeof obj !== 'object') {
                if (typeof obj === 'function') {
                    try {
                        for (let i = 0; i < this.data.length; i++) if (obj(data[i])) return this.data[i]
                    } catch (e) {
                        return rej(e)
                    }
                    return res(results)
                } else {
                    return rej(`BAD QUERY: ${JSON.stringify(obj)}`)
                }
            }
            let results = []
            let keys = Object.entries(obj)
            for (let i = 0; i < this.data.length; i++) {
                let count = 0
                for (let o = 0; o < keys.length; o++) {
                    if (!this.data[i][keys[o][0]]) continue
                    let a = await this.compare(keys[o][1], this.data[i][keys[o][0]])
                    if (a) { count++ }
                }
                if (count === keys.length) results.push(this.data[i])
            }
            return res(results)
        })
    }
    findAll = (obj, opt) => {
        return new Promise(async (res, rej) => {
            let results = []
            if (!obj || typeof obj !== 'object') {
                if (typeof obj === 'function') {
                    try {
                        for (let i = 0; i < this.data.length; i++) if (obj(this.data[i])) results.push(this.data[i])
                    } catch (e) {
                        return rej(e)
                    }
                    return res(results)
                } else {
                    return rej(`BAD QUERY: ${JSON.stringify(obj)}`)
                }
            }
            let keys = Object.entries(obj)
            let limit = opt && opt.limit ? opt.limit : Infinity
            let optionKeys = opt && opt.keys && typeof opt.keys === 'object' && opt.keys.length > 0 ? opt.keys : null
            for (let i = 0; i < this.data.length; i++) {
                let count = 0
                for (let o = 0; o < keys.length; o++) {
                    if (!this.data[i][keys[o][0]]) continue
                    let a = await this.compare(keys[o][1], this.data[i][keys[o][0]])
                    if (a) { count++ }
                }
                if (count === keys.length) results.push(this.data[i])
                if (i >= limit - 1) i = Infinity
            }
            let reason = []
            for (let i = 0; i < results.length; i++) {
                if ((results[i]._recordData && !optionKeys) || (optionKeys && optionKeys.includes('data') && results[i]._recordData)) {
                    results[i].data = await this.readRecord(results[i]._recordData).catch(async e => {
                        console.log(e)
                        results[i]._recordData = null
                        await save(results[i]).catch(e => {
                            console.log(e)
                            this.delete(u._id).then(() => {
                                this.save().then(() => {
                                    console.log('RECORD CORRUPTED. REMOVED.', u._id)
                                    return null
                                }).catch(e => {
                                    console.log(e)
                                    console.log('RECORD CORRUPTED.', u._id)
                                    return null
                                })
                            }).catch(e => {
                                console.log(e)
                                console.log('RECORD CORRUPTED. FAILED TO REMOVE', u._id)
                                return null
                            })
                        })
                        return null
                    })
                }
                if (optionKeys) {
                    for (let z = 0; z < results.length; z++) {
                        let r = {}
                        for (let i = 0; i < optionKeys.length; i++) r[optionKeys[i]] = results[z][optionKeys[i]] ? results[z][optionKeys[i]] : null
                        reason.push(r)
                    }
                } else {
                    reason.push(results[i])
                }
            }
            return res(reason)
        })
    }
    save = d => {
        return new Promise(async (res, rej) => {
            let s = () => {
                return new Promise((res, rej) => {
                    try {
                        if (!fs.existsSync(this.DB || DBDEFAULT)) {
                            this.init(this.db)
                        } else {
                            let temp = path.resolve(path.join(DBPATH, (this.db || '') + 'temp.json'))
                            let final = this.DB || DBDEFAULT
                            fs.writeFileSync(temp, this.encrypted ? this.encrypt(JSON.stringify(this.data)) : JSON.stringify(this.data))
                            fs.renameSync(temp, final)
                        }
                    } catch (e) {
                        if (e && e.code === 'EPERM') {
                            return res(true)
                        } else {
                            return rej(e)
                        }
                    } finally {
                        return res(d || true)
                    }
                })
            }
            if (d && typeof d === 'object' && d instanceof Data) {
                let a = false
                for (let i = 0; i < this.data.length; i++) if (this.data[i]._id === d._id) {
                    this.data[i] = d
                    a = true
                    i = Infinity
                }
                if (!a) this.data.unshift(d)
            } else if (d && typeof d === 'object' && d instanceof Array) {
                for (let z = 0; z < d.length; z++) {
                    if (d[z] && typeof d[z] === 'object' && d[z] instanceof Data) {
                        let a = false
                        for (let i = 0; i < this.data.length; i++) if (this.data[i]._id === d[z]._id) {
                            this.data[i] = d[z]
                            a = true
                            i = Infinity
                        }
                        if (!a) this.data.unshift(d[z])
                    }
                }
            }
            s().then(result => {
                return res(result)
            }).catch(e => {
                return rej(e)
            })
        })
    }
    push = d => {
        return new Promise((res, rej) => {
            if (!d || typeof d !== 'object' || !d instanceof Data) return rej('NOT OBJECT')
            if (d && typeof d === 'object' && d instanceof Data) {
                let a = false
                for (let i = 0; i < this.data.length; i++) if (this.data[i]._id === d._id) {
                    this.data[i] = d
                    a = true
                    i = Infinity
                }
                if (!a) this.data.unshift(d)
            } else if (d && typeof d === 'object' && d instanceof Array) {
                for (let z = 0; z < d.length; z++) {
                    if (d[z] && typeof d[z] === 'object' && d[z] instanceof Data) {
                        let a = false
                        for (let i = 0; i < this.data.length; i++) if (this.data[i]._id === d[z]._id) {
                            this.data[i] = d[z]
                            a = true
                            i = Infinity
                        }
                        if (!a) this.data.unshift(d[z])
                    }
                }
            }
            return res(d)
        })
    }
    delete = id => {
        return new Promise(async (res, rej) => {
            if (!id || typeof id !== 'string') return rej('NO ID TO DELETE')
            let result = null
            this.data = [...this.data].filter(u => {
                if (u._id === id) {
                    result = u
                    if (u._recordData) {
                        fs.unlink(u._recordData, () => { })
                        return false
                    } else {
                        return false
                    }
                } else {
                    return true
                }
            })
            this.save().then(() => res(result)).catch(e => rej(e))
        })
    }
    deleteMany = obj => {
        return new Promise(async (res, rej) => {
            let results = []
            let ar = [...this.data]
            if (!obj || typeof obj !== 'object') {
                if (typeof obj === 'function') {
                    for (let i = 0; i < ar.length; i++) if (obj(ar[i])) results.push(ar[i])
                } else {
                    return rej('NO OBJECT')
                }
            } else {
                let keys = Object.entries(obj)
                for (let i = 0; i < ar.length; i++) {
                    let count = 0
                    for (let o = 0; o < keys.length; o++) {
                        if (!ar[i][keys[o][0]]) continue
                        if (this.compare(keys[o][1], ar[i][keys[o][0]])) { count++ }
                    }
                    if (count === keys.length) results.push(ar[i])
                }
            }
            let ids = results.map(u => u._id)
            let z = []
            for (let i = 0; i < this.data.length; i++) {
                if (ids.includes(this.data[i]._id)) {
                    if (this.data[i]._recordData) {
                        try {
                            await fs.unlinkSync(this.data[i]._recordData)
                        } catch { }
                    }
                    z.push(this.data.splice(i, 1)[0])
                    i--
                }
            }
            if (z < results.length) throw new Error('TO SHORT')
            this.save().then(() => res(z)).catch(e => rej(e))
        })
    }
    filterData = func => {
        return new Promise((res, rej) => {
            this.data = [...this.data].filter(func)
            this.save().then(() => {
                return res(true)
            }).catch(e => {
                return rej(e)
            })
        })
    }
    mapData = func => {
        return new Promise(async (res, rej) => {
            this.data = [...this.data].map(func)
            this.save().then(a => res(a)).catch(e => {
                return rej(`FAILED TO SAVE: ${e}`)
            })
        })
    }
    reduceData = func => {
        return new Promise((res, rej) => {
            this.data = [...this.data].reduce(func, [])
            this.save().then(r => res(r)).catch(e => rej(e))
        })
    }
    createRecord = (id, data) => {
        return new Promise((res, rej) => {
            if (!id) return rej('NO ID')
            if (!data || typeof data !== 'object') return rej('DATA MUST BE OF TYPE OBJECT')
            let recordbook = path.resolve(path.join(DBPATH, 'records'))
            if (!fs.existsSync(recordbook)) fs.mkdirSync(recordbook)
            let address = path.join(recordbook, `${id}.json`)
            fs.writeFile(address, JSON.stringify(data), err => {
                if (err) return rej(err)
                return res(address)
            })
        })
    }
    getRecord = _id => {
        return new Promise((res, rej) => {
            if (!_id) return rej('NO ID')
            this.find({ _id }).then(result => {
                if (result._recordData) {
                    this.readRecord(result._recordData).then(result => {
                        if (!result) return rej('Missing record')
                        return res(result)
                    }).catch(e => {
                        return rej(e)
                    })
                } else {
                    return rej({ record: true })
                }
            }).catch(e => {
                console.log(e)
                return rej('UNABLE TO FIND ENTRY')
            })
        })
    }
    replaceRecord = (address, data) => {
        return new Promise(async (res, rej) => {
            let recordtemp = path.resolve(path.join(DBPATH, '/records/tmp'))
            if (!fs.existsSync(recordtemp)) await fs.mkdirSync(recordtemp)
            let tmp = address.split('/records/').join('/records/tmp/')
            fs.writeFile(tmp, JSON.stringify(data), async err => {
                if (err) return rej(e)
                try {
                    await fs.renameSync(tmp, address)
                } catch (e) {
                    return rej(e)
                } finally {
                    return res(true)
                }
            })
        })
    }
    runRecords = async () => {
        let m = [...this.data]
        for (let i = 0; i < m.length; i++) {
            if (m[i] && m[i].data && (typeof m[i].data === 'object') && !m[i]._recordData) {
                let id = m[i]._id
                let d = m[i].data
                m[i]._recordData = await this.createRecord(id, d).catch(e => console.log(e))
                m[i].data = null
            } else if (m[i] && m[i].data && m[i].data !== null && typeof m[i].data === 'object' && m[i]._recordData) {
                await this.replaceRecord(m[i]._recordData, m[i].data).then(() => {
                    m[i].data = null
                }).catch(e => {
                    if (e && e.code !== 'ENOENT' && e.code !== 'EPERM') { console.log(e) }
                })
            }
        }
        this.data = m
        this.save().catch(e => console.log(e))
    }
    manage = (func, timeframe) => {
        return new Promise((res) => {
            setInterval(func, timeframe ? timeframe : 1000 * 60 * 5)
            return res(true)
        })
    }
}
const isPromise = (p) => typeof p === 'object' && typeof p.then === 'function'
const returnsPromise = (f) => f && (f.constructor.name === 'AsyncFunction' || f instanceof Promise || (typeof f === 'function' && typeof f === 'object' && typeof f.then === 'function'))
class Model extends Data {
    constructor(props, name, validator, schema) {
        super(props, name, validator, schema)
        if (schema && typeof schema === 'object') {
            let valid = validateObjectTypes(props, schema)
            if (!valid) throw new Error('INVALID DATA')
            if (typeof valid !== 'boolean') throw new Error(`Invalid data when constructing new ${name}. KEY: ${valid.key} VALUE: ${valid && valid.value ? valid.value.toString() : 'null | undefined'} REASON: ${valid.message} `)
        }
        if (typeof validator === 'function') {
            if (returnsPromise(validator)) throw new Error('Validator must be synchronous.')
            props = validator(props)
            if (props && typeof props === 'object') Object.entries(props).forEach(([key, value]) => this[key] = value)
        }
        this._m = name
    }
}
const constructModel = (model, data) => model(data)
const buildModel = (name, validator, schema) => data => constructModel(data => returnsPromise(validator) ? new Promise(async (res) => {
    let d = await validator(data)
    let model = new Model(d || data, name, schema)
    return res(model)
}) : new Model(data, name, validator, schema), data)
const makeModel = (database, name, validator, schema) => {
    class ModelClass {
        constructor(data) {
            this.name = name
            this.validator = validator
            this.schema = schema
            this.model = buildModel(this.name, this.validator, this.schema)
            if (data) this._doc = this.model(data)
        }
        save(data) {
            return new Promise((res, rej) => {
                if (!data && isPromise(this._doc)) {
                    this._doc.then(data => {
                        database.save(data ? { ...data, _m: this.name } : this._doc).then(r => {
                            return res(r)
                        }).catch(e => rej(e))
                    })
                } else {
                    database.save(data ? { ...data, _m: this.name } : this._doc).then(r => {
                        return res(r)
                    }).catch(e => rej(e))
                }
            })
        }
        sort = sort
        filter = filter
        find(query) {
            return new Promise((res, rej) => {
                database.find(typeof query === 'function' ? query : { ...query, _m: this.name }).then(r => res(r)).catch(e => rej(e))
            })
        }
        findAll(query, options = {}) {
            return new Promise((res, rej) => {
                database.findAll(typeof query === 'function' ? query : { ...query, _m: this.name }).then(r => {
                    if (typeof options.filter === 'object') r = this.filter(r, options.filter instanceof Array ? options.filter : [options.filter])
                    if (typeof options.sort === 'object') r = this.sort(r, options.sort instanceof Array ? options.sort : [options.sort])
                    res(r)
                }).catch(e => rej(e))
            })
        }
        delete(_id) {
            return new Promise((res, rej) => {
                database.delete(_id).then(r => res(r)).catch(e => rej(e))
            })
        }
        deleteOne(query) {
            return new Promise((res, rej) => {
                database.deleteMany(a => database.compare(a, typeof query === 'function' ? query : { ...query, _m: this.name })).then(r => res(r)).catch(e => rej(e))
            })
        }
        deleteMany(query) {
            return new Promise((res, rej) => {
                database.deleteMany(typeof query === 'function' ? query : { ...query, _m: this.name }).then(r => res(r)).catch(e => rej(e))
            })
        }
    }
    return ModelClass
}
const makeModels = (database, models) => {
    return models.map(u => ({ name: u.name, model: makeModel(database, u.name, u.validator, u.schema) })).reduce((a, b) => {
        a[b.name] = b.model
        return a
    }, {})
}
const construct = (model, data) => {
    return new Promise((res, rej) => {
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
module.exports = {
    Data,
    Model,
    makeModels,
    makeModel,
    construct,
    db
}