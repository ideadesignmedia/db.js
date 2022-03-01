class db {
  constructor(URI, auth) {
    if (!URI) throw new Error('Missing database URI')
    this.DBURI = URI
    this.reconnect = 0
    this.wsinitial = false
    this.lastPing = null
    this.lastPingTime = null
    this.currentPing = 0
    if (auth) localStorage.setItem('DBAUTH', auth)
    this.auth = auth || localStorage.getItem('DBAUTH')
    if (!this.auth || this.auth == 'undefined') throw new Error('Missing database authentication')
    this.socketWait = null
    this.que = []
    this.newSocket()
  }
  sendPing = () => {
    this.lastPing = Math.floor(Math.random() * 10000)
    this.lastPingTime = new Date().getTime()
    this.ws.sendData({ type: 'ping', data: this.lastPing })
  }
  flash = e => console.log(e)
  checkws = () => {
    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
      this.newSocket().catch(e => { this.flash(`WS ERROR: ${JSON.stringify(e)}`) })
    } else {
      this.sendPing()
    }
  }
  checkauth = () => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && (this.auth && this.auth !== 'undefined')) this.ws.sendData({ type: 'auth', data: { method: 'check', auth: this.auth } })
  }
  logOut = () => {
    this.auth = null
    localStorage.removeItem('DBAUTH')
  }
  runSocket = (e) => {
    let that
    try {
      that = JSON.parse(e)
    } catch (err) {
      try {
        that = JSON.parse(e.data)
      } catch (e) {
        return console.log(`RECEIVED DATA: ${JSON.stringify(e)}`)
      }
    }
    if (that && that.type) {
      let { type, data, error, _id } = that
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
          if (request && typeof request.callback === 'function') request.callback(that.message || JSON.stringify(that), null)
          break
        }
        case 'response': {
          if (request && typeof request.callback === 'function') request.callback(null, data)
          break
        }
        case 'auth': {
          if (error) {
            this.flash(that.message || 'Issue with authenticating you, please sign in again')
            this.logOut()
          } else {
            this.authenticated = true
          }
          break
        }
        case 'ping': {
          if (this.lastPing !== data) {
            this.sendPing()
          } else {
            this.currentPing = `Current Ping: ${new Date().getTime() - this.lastPingTime}ms`
          }
          break
        }
        default: {
          return this.handleSocket(type, data, error)
        }
      }
    }
  }
  waitForSocketConnection = (socket, callback, data, timer = 1000) => {
    clearTimeout((this.socketWait))
    if (!callback || typeof callback !== 'function') return
    if (socket.readyState === 0) {
      this.socketWait = setTimeout(() => { this.waitForSocketConnection(socket, callback, data, timer) }, timer)
    } else if (socket.readyState === 1) {
      callback(data)
    } else {
      this.socketWait = this.waitForSocketConnection(socket, callback, data, timer)
    }
  }
  waitForAuth = (socket, callback, data, timer = 1000, rounds = 0) => {
    clearTimeout((this.socketWaitForAuth))
    if (!callback || typeof callback !== 'function' || rounds > 10) return
    if (!this.authenticated) {
      this.socketWaitForAuth = setTimeout(() => { this.waitForAuth(socket, callback, data, timer) }, timer, rounds + 1)
    } else {
      callback(data)
    }
  }
  send = (type, data, _id) => this.ws.sendData({ type, data, _id })
  handle = (type, data) => {
    return new Promise((res, rej) => {
      let _id = `${new Date().getTime()}${Math.floor(Math.random() * 1000)}`
      let hand = setTimeout(() => rej('Timeout'), 30000)
      this.que.push({
        type, data, _id, callback: (err, data) => {
          clearTimeout(hand)
          if (err) return rej(err)
          res(data)
        }
      })
      this.send(type, data, _id)
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
  newSocket = () => {
    return new Promise((res, rej) => {
      clearInterval(this.heartbeat)
      clearTimeout((this.socketWait))
      clearTimeout((this.socketWaitForAuth))
      try {
        this.ws = new WebSocket(this.DBURI)
        this.ws.onopen = function (e) { this.heartbeat = setInterval(() => { this.checkws() }, 10000); };
        this.waitForSocketConnection(this.ws, () => { if (this.auth && typeof this.auth !== 'undefined') this.ws.sendData({ type: 'auth', data: { auth: this.app.state.auth } }) })
        this.ws.onmessage = function incoming(data) { this.runSocket(data) }
        this.ws.sendData = (data) => {
          if (!this.authenticated && data.type !== 'auth') {
            this.waitForAuth(this.ws, data => { this.ws.send(JSON.stringify(data)) }, data)
          } else if (this.ws.readyState !== 1) {
            this.waitForSocketConnection(this.ws, data => { this.ws.send(JSON.stringify(data)) }, data)
          } else {
            this.ws.send(JSON.stringify(data))
          }
        }
        this.ws.onclose = () => {
          this.newSocket()
        }
        return res(true)
      } catch {
        if (!this.wsinitial) return rej('Error loading websocket')
        if (this.reconnect <= 10) {
          setTimeout(() => {
            this.reconnect++
            this.newSocket()
          }, this.reconnect * 3000)
        } else {
          return rej('Error reloading websocket. must be an issue on the backend.')
        }
      }
    })
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
module.exports = {
  db,
  Data,
  Model,
  makeModel,
  makeModels
}