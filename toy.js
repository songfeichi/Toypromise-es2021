
const states = {
    PENDING: 'pending',
    FULFILLED: 'fulfilled',
    REJECTED: 'rejected',
}

function resolvePromise(promise, x, resolve, reject) {
    if(promise == x){
        return reject(new TypeError(
            'TypeError: Chaining cycle detected for promise #<Toy>'
        ))
    }
    let called = false
    if((typeof x === 'object' && x!==null) || typeof x ==='function'){
        try{
            let then= x.then
            if(typeof then==='function'){
                then.call(x,y=>{
                    if(called)return
                    called=true
                    resolvePromise(promise,y,resolve,reject)
                },r=>{
                    if(called)return
                    called=true
                    reject(r)
                })
            }else{
                resolve(x)
            }
        }catch(e){
            if(called)return
            called=true
            reject(e)
        }
    }
    else{
        resolve(x)
    }
}

class Toy {
    constructor(executor) {
        this.value = undefined
        this.reason = undefined
        this.state = states.PENDING
        this._thenQ = []
        this._finallyQ = []
        this.onFulfilledCB = []
        this.onRejectedCB = []
        this.onFinallyCB = []
        const resolve = value => {
            if (this.state === states.PENDING) {
                this.value = value
                this.state = states.FULFILLED
                this.onFulfilledCB.forEach(cb => cb(this.value))
                this.onFinallyCB.forEach(cb => cb())
            }
        }
        const reject = reason => {
            if (this.state === states.PENDING) {
                this.reason = reason
                this.state = states.REJECTED
                this.onRejectedCB.forEach(cb => cb(this.reason))
                this.onFinallyCB.forEach(cb => cb())
            }
        }
        if (executor && typeof executor === 'function') {
            try {
                executor(resolve, reject)
            } catch (e) {
                reject(e)
            }
        }
        else {
            throw new TypeError(`Promise resolver ${executor} is not a function`)
        }

    }
    
    then(onFulfilled, onRejected) {
        // 判断参数是否为函数，如果不是函数，使用默认函数替代
        // onFulfilled = typeof onFulfilled === "function" ?queueMicrotask(onFulfilled) :queueMicrotask( (v) => v )
        // onRejected = typeof onRejected === "function"?queueMicrotask( onRejected):queueMicrotask( (e) => {throw e} )
        onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (v) => v
        onRejected = typeof onRejected === "function" ? onRejected : (e) => { throw e }
        let next = new Toy((resolve, reject) => {
            if (this.state === states.PENDING) {
                this.onFulfilledCB.push(() => {
                    queueMicrotask(() => {
                        try {
                            let x = onFulfilled(this.value)
                            resolvePromise(next,x,resolve,reject)
                        } catch (e) {
                            reject(e)
                        }
                    })
                })
                this.onRejectedCB.push(() => {
                    queueMicrotask(() => {
                        try {
                            let x = onRejected(this.reason)
                            resolvePromise(next,x,resolve,reject)
                        } catch (e) {
                            reject(e)
                        }
                    })
                })

            }
            else if (this.state === states.FULFILLED) {
                queueMicrotask(() => {
                    try {
                        let x = onFulfilled(this.value)
                        resolvePromise(next,x,resolve,reject)
                    } catch (e) {
                        reject(e)
                    }
                })
            }
            else if (this.state === states.REJECTED) {
                queueMicrotask(() => {
                    try {
                        let x = onRejected(this.reason)
                        resolvePromise(next,x,resolve,reject)
                    } catch (e) {
                        reject(e)
                    }
                })
            }
        })
        return next
    }
    catch(onRejected){
        return this.then(undefined,onRejected)
    }
    finally(onFinally){
        let next = new Toy((resolve, reject) => {
            if (this.state === states.PENDING) {
                this.onFinallyCB.push(() => {
                    queueMicrotask(() => {
                        try {
                            if(typeof onFinally === 'function'){
                                onFinally()
                            }
                            if(this.value)resolve(this.value)
                            else reject(this.reason)
                        } catch (e) {
                            reject(e)
                        }
                    })
                })
            }
            else{
                queueMicrotask(() => {
                    try {
                        if(typeof onFinally === 'function'){
                            onFinally()
                        }
                        if(this.value)resolve(this.value)
                        else reject(this.reason)
                    } catch (e) {
                        reject(e)
                    }
                })
            }

        })
        return next
    }
    static resolve (value){
        if(value instanceof Toy || value instanceof Promise)return value
        if(value && typeof value.then ==='function'){
            return new Toy(value.then)
        }
        return new Toy((resolve) => {
            resolve(value)
        })
    }
    static reject (reason){
        return new Toy((_, reject) => {
            reject(reason)
        })
    }
    static all(promises){
        const result=[]
        let count=0,fulfilled_count=0   
        return new Promise((resolve,reject)=>{
            try{
                for(let p of promises){
                    let i=count++
                    Toy.resolve(p).then(v=>{
                        fulfilled_count++
                        result[i]=v
                        if(count===fulfilled_count){
                            resolve(result)
                        }
                    },reject)
                }
                if(count===0){
                    resolve(result)
                }

            }
            catch(e){
                reject(`${promises} is not iterable (cannot read property Symbol(Symbol.iterator))`)
            }
        })
    }
    static allSettled(promises){
        const result=[]
        let count=0,fulfilled_count=0   
        return new Promise((resolve,reject)=>{
            try{
                for(let p of promises){
                    let i=count++
                    Toy.resolve(p).then(v=>{
                        fulfilled_count++
                        result[i]={
                            status:'fulfilled',
                            value:v
                        }
                        if(count===fulfilled_count){
                            resolve(result)
                        }
                    },r=>{
                        fulfilled_count++
                        result[i]={
                            status:'rejected',
                            reason:r
                        }
                        if(count===fulfilled_count){
                            resolve(result)
                        }                        
                    })
                }
                if(count===0){
                    resolve(result)
                }

            }
            catch(e){
                reject(`${promises} is not iterable (cannot read property Symbol(Symbol.iterator))`)
            }
        })
    }
    static race(promises){
        //race 方法形象化来讲就是赛跑机制，只认第一名，不管是成功的第一还是失败的第一。
        return new Toy((resolve,reject)=>{
            try{
                for(let p of promises){
                    Toy.resolve(p).then(resolve,reject)
                }
            }catch(e){
                reject(`${promises} is not iterable (cannot read property Symbol(Symbol.iterator))`)
            }
        })
    }
    static any(promises){
        //只要第一个成功者。如果全部失败了，就返回失败情况。
        return new Toy((resolve,reject)=>{
            let count = 0;
            let rejectCount = 0;
            let errors = [];
            
            try{
                for (let p of promises) {
                    let i = count++
                    Toy.resolve(p).then(res => {
                        resolve(res)
                    }).catch(error => {
                        errors[i] = error;
                        rejectCount ++;
                        if (rejectCount === count) {
                            reject(new AggregateError(errors,'All promises were rejected'))
                        }
                    })
                }
                if(count === 0) 
                    reject(new AggregateError(errors,'All promises were rejected'))
            }catch(e){
                reject(`${promises} is not iterable (cannot read property Symbol(Symbol.iterator))`)
            }
        })
    }
}


Toy.deferred = function () {
    let dfd = {};
    dfd.promise = new Toy((resolve, reject) => {
      dfd.resolve = resolve;
      dfd.reject = reject;
    });
    return dfd;
};
module.exports = Toy
