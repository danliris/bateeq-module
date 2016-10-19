'use strict';

// external deps 
var ObjectId = require('mongodb').ObjectId;

// internal deps
require('mongodb-toolkit');
var BateeqModels = require('bateeq-models');
var map = BateeqModels.map;

var Payment = BateeqModels.pos.Payment;
var generateCode = require('../../utils/code-generator');


module.exports = class PaymentManager {
    constructor(db, user) {
        this.db = db;
        this.user = user;
        this.paymentCollection = this.db.use(map.pos.PaymentDoc);
    }

    read(paging) {
        var _paging = Object.assign({
            page: 1,
            size: 20,
            order: '_id',
            asc: true
        }, paging);

        return new Promise((resolve, reject) => {
            var deleted = {
                _deleted: false
            };
            var query = _paging.keyword ? {
                '$and': [deleted]
            } : deleted;

            if (_paging.keyword) {
                var regex = new RegExp(_paging.keyword, "i");
                var filterCode = {
                    'code': {
                        '$regex': regex
                    }
                }; 
                var $or = {
                    '$or': [filterCode]
                };

                query['$and'].push($or);
            }


            this.paymentCollection
                .where(query)
                .page(_paging.page, _paging.size)
                .orderBy(_paging.order, _paging.asc)
                .execute()
                .then(payments => {
                    resolve(payments);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getById(id) {
        return new Promise((resolve, reject) => {
            if (id === '')
                resolve(null);
            var query = {
                _id: new ObjectId(id),
                _deleted: false
            };
            this.getSingleByQuery(query)
                .then(payment => {
                    resolve(payment);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getByIdOrDefault(id) {
        return new Promise((resolve, reject) => {
            if (id === '')
                resolve(null);
            var query = {
                _id: new ObjectId(id),
                _deleted: false
            };
            this.getSingleOrDefaultByQuery(query)
                .then(payment => {
                    resolve(payment);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getByCode(code) {
        return new Promise((resolve, reject) => {
            var query = {
                code: code,
                _deleted: false
            };
            this.getSingleByQuery(query)
                .then(payment => {
                    resolve(payment);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getSingleByQuery(query) {
        return new Promise((resolve, reject) => {
            this.paymentCollection
                .single(query)
                .then(payment => {
                    resolve(payment);
                })
                .catch(e => {
                    reject(e);
                });
        })
    }

    getSingleOrDefaultByQuery(query) {
        return new Promise((resolve, reject) => {
            this.paymentCollection
                .singleOrDefault(query)
                .then(payment => {
                    resolve(payment);
                })
                .catch(e => {
                    reject(e);
                });
        })
    }

    create(payment) {
        return new Promise((resolve, reject) => {
            payment.code = generateCode("payment");
            this._validate(payment)
                .then(validPayment => { 
                    this.paymentCollection.insert(validPayment)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    update(payment) {
        return new Promise((resolve, reject) => {
            this._validate(payment)
                .then(validPayment => {
                    this.paymentCollection.update(validPayment)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    delete(payment) {
        return new Promise((resolve, reject) => {
            this._validate(payment)
                .then(validPayment => {
                    validPayment._deleted = true;
                    this.paymentCollection.update(validPayment)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }
 
    _validate(payment) {
        var errors = {};
        return new Promise((resolve, reject) => {
            var valid = new Payment(payment);
            // 1. begin: Declare promises.
            var getPayment = this.paymentCollection.singleOrDefault({
                "$and": [{
                    _id: {
                        '$ne': new ObjectId(valid._id)
                    }
                }, {
                        code: valid.code
                    }]
            });
            // 1. end: Declare promises.

            // 2. begin: Validation.
            Promise.all([getPayment])
                .then(results => {
                    var _payment = results[0];

                    if (!valid.code || valid.code == '')
                        errors["code"] = "code is required";
                    else if (_payment) {
                        errors["code"] = "code already exists";
                    } 
                    
                    // 2c. begin: check if data has any error, reject if it has.
                    for (var prop in errors) {
                        var ValidationError = require('../../validation-error');
                        reject(new ValidationError('data does not pass validation', errors));
                    }

                    valid.stamp(this.user.username, 'manager');
                    resolve(valid);
                })
                .catch(e => {
                    reject(e);
                })
        });
    }
};