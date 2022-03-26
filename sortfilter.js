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
module.exports = { sort, filter }