const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const DBPATH = process.env.DBPATH || './database'
const DBDEFAULT = path.resolve(path.join(DBPATH, 'data.json'))
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
            this._u = new Date
        }
    }
}
class db {
    constructor(db, key, buffer, algorithm) {
        this.db = db
        this.algorithm = algorithm || 'aes-256-ctr';
        if (key) { this.encrypted = true; this.key = key }
        if (buffer) {
            if (buffer instanceof Buffer) {
                this.buffer = buffer
            } else {
                this.buffer = Buffer.from('61bd456b9bb5548495246dee991a6baa', 'hex')
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
        if (!fs.existsSync(DBPATH)) { console.log('no dir'); fs.mkdirSync(DBPATH) }
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
    findData = obj => {
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
                complete = await this.find(['id', id])
            } else {
                complete = await this.find(Object.entries(obj))
            }
            if (complete && complete.recordData) complete.data = await this.readRecord(complete.recordData).catch(e => {
                console.log(e)
                complete.recordData = null
                this.save(complete).then((result) => {
                    return res(result)
                }).catch(e => {
                    console.log(e)
                    this.deleteData(complete._id).then(() => {
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
                if ((results[i].recordData && !optionKeys) || (optionKeys && optionKeys.includes('data') && results[i].recordData)) {
                    results[i].data = await this.readRecord(results[i].recordData).catch(async e => {
                        console.log(e)
                        results[i].recordData = null
                        await save(results[i]).catch(e => {
                            console.log(e)
                            this.deleteData(u._id).then(() => {
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
                            fs.writeFileSync(temp, this.ecrypted ? this.encrypt(JSON.stringify(this.data)) : JSON.stringify(this.data))
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
    pushData = d => {
        return new Promise((res, rej) => {
            if (!d || typeof d !== 'object' || !d instanceof Data) return rej('NOT OBJECT')
            this.data.push(d)
            return res(true)
        })
    }
    deleteData = id => {
        return new Promise(async (res, rej) => {
            if (!id || typeof id !== 'string') return rej('NO ID TO DELETE')
            let result = null
            this.data = [...this.data].filter(u => {
                if (u._id === id) {
                    result = u
                    if (u.recordData) {
                        fs.unlink(u.recordData, () => { })
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
                        if (compare(keys[o][1], ar[i][keys[o][0]])) { count++ }
                    }
                    if (count === keys.length) results.push(ar[i])
                }
            }
            let ids = results.map(u => u._id)
            let z = []
            for (let i = 0; i < this.data.length; i++) {
                if (ids.includes(this.data[i]._id)) {
                    if (this.data[i].recordData) {
                        try {
                            await fs.unlinkSync(this.data[i].recordData)
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
    checkRecord = id => {
        return new Promise((res, rej) => {
            if (!id) return rej('NO ID')
            this.findData({ id: id }).then(result => {
                if (result.recordData) {
                    this.readRecord(result.recordData).then(result => {
                        if (!result) return res(true)
                        return res(false, result)
                    }).catch(e => {
                        console.log(e)
                        return res(true)
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
            if (m[i] && m[i].data && (typeof m[i].data === 'object') && !m[i].recordData) {
                let id = m[i]._id
                let d = m[i].data
                m[i].recordData = await this.createRecord(id, d).catch(e => console.log(e))
                m[i].data = null
            } else if (m[i] && m[i].data && m[i].data !== null && typeof m[i].data === 'object' && m[i].recordData) {
                await this.replaceRecord(m[i].recordData, m[i].data).then(() => {
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
module.exports = {
    Data,
    db
}