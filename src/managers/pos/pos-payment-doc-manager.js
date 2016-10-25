'use strict';

// external deps 
var ObjectId = require('mongodb').ObjectId;

// internal deps
require('mongodb-toolkit');
var BateeqModels = require('bateeq-models');
var map = BateeqModels.map;

var Payment = BateeqModels.pos.Payment; 
var TransferOutDoc = BateeqModels.inventory.TransferOutDoc;
var generateCode = require('../../utils/code-generator');


module.exports = class PaymentManager {
    constructor(db, user) {
        this.db = db;
        this.user = user;
        this.paymentCollection = this.db.use(map.pos.PaymentDoc);
        
        var ArticleVariantManager = require('../core/article/article-variant-manager');
        this.articleVariantManager = new ArticleVariantManager(db, user);
        
        var StoreManager = require('../inventory/store-manager');
        this.storeManager = new StoreManager(db, user); 
        
        var BankManager = require('../pos-master/bank-manager');
        this.bankManager = new BankManager(db, user);  
        
        var CardTypeManager = require('../pos-master/card-type-manager');
        this.cardTypeManager = new CardTypeManager(db, user);  
        
        var PaymentTypeManager = require('../pos-master/payment-type-manager');
        this.paymentTypeManager = new PaymentTypeManager(db, user);  
        
        var TransferOutDocManager = require('../inventory/transfer-out-doc-manager');
        this.transferOutDocManager = new TransferOutDocManager(db, user);
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
                    var validTransferOutDoc = {};
                    validTransferOutDoc.code = generateCode("payment");
                    validTransferOutDoc.reference = validPayment.code;
                    validTransferOutDoc.sourceId = validPayment.store.storageId;
                    validTransferOutDoc.destinationId = validPayment.store.storageId;
                    validTransferOutDoc.items = [];
                    for (var item of validPayment.items) {
                        var newitem = {};
                        newitem.articleVariantId = item.articleVariantId;
                        newitem.quantity = item.quantity;
                        validTransferOutDoc.items.push(newitem);
                    } 
                    validTransferOutDoc = new TransferOutDoc(validTransferOutDoc);
                    
                    var createData = [];
                    createData.push(this.paymentCollection.insert(validPayment));
                    createData.push(this.transferOutDocManager.create(validTransferOutDoc));
                    
                    Promise.all(createData)
                        .then(results => {
                            resolve(results[0]);
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
            
            var paymentDetailError = {};
            if (!valid.code || valid.code == '')
                errors["code"] = "code is required";
            if (!payment.storeId || payment.storeId == '')
                errors["storeId"] = "storeId is required"; 
            if (!payment.paymentDetail.paymentTypeId || payment.paymentDetail.paymentTypeId == '')
                paymentDetailError["paymentTypeId"] = "paymentTypeId is required";
            
            for (var prop in paymentDetailError) {
                errors["paymentDetail"] = paymentDetailError;
                break;
            }
                                

            //Get Payment data
            var getPayment = this.paymentCollection.singleOrDefault({
                "$and": [{
                    _id: {
                        '$ne': new ObjectId(valid._id)
                    }
                }, {
                        code: valid.code
                    }]
            });  
            var getStore = this.storeManager.getByIdOrDefault(payment.storeId);
            var getBank = this.bankManager.getByIdOrDefault(payment.paymentDetail.bankId);
            var getCardType = this.cardTypeManager.getByIdOrDefault(payment.paymentDetail.cardTypeId);
            var getPaymentType = this.paymentTypeManager.getByIdOrDefault(payment.paymentDetail.paymentTypeId);
            var getVoucher = Promise.resolve(null);
            var getItems = [];
            if (valid.items && valid.items.length > 0) {
                for (var item of valid.items) {  
                    getItems.push(this.articleVariantManager.getByIdOrDefault(item.articleVariantId));
                }
            }
            else {
                errors["items"] = "items is required";
            }
            
            Promise.all([getPayment, getStore, getBank, getCardType, getPaymentType, getVoucher].concat(getItems))
               .then(results => {
                    var _payment = results[0];
                    var _store = results[1];
                    var _bank = results[2];
                    var _cardType = results[3];
                    var _paymentType = results[4];
                    var _voucherType = results[5];

                    if (_payment) {
                        errors["code"] = "code already exists";
                    }  
                    
                    if (!_store) {
                        errors["storeId"] = "storeId not found";
                    }
                    else {
                        valid.storeId = _store._id;
                        valid.store = _store;
                    } 
                      
                    valid.totalProduct = 0;
                    valid.subTotal = 0;
                    valid.grandTotal = 0;
                    var articleVariants = results.slice(6, results.length) 
                    if (articleVariants.length > 0) {
                        var itemErrors = [];
                        for (var variant of articleVariants) {
                            var index = articleVariants.indexOf(variant);
                            var item = valid.items[index];
                            var itemError = {};

                            if (!item.articleVariantId || item.articleVariantId == '') {
                                itemError["articleVariantId"] = "articleVariantId is required";
                            }
                            else {
                                for (var i = valid.items.indexOf(item) + 1; i < valid.items.length; i++) {
                                    var otherItem = valid.items[i];
                                    if (item.articleVariantId == otherItem.articleVariantId) {
                                        itemError["articleVariantId"] = "articleVariantId already exists on another detail";
                                    }
                                }
                            }
                            if (!variant) {
                                itemError["articleVariantId"] = "articleVariantId not found";
                            }
                            else {
                                item.articleVariantId = variant._id;
                                item.articleVariant = variant;
                                if(variant.size)
                                    if(variant.size.name)
                                        item.size = variant.size.name;
                                item.price = parseInt(variant.domesticSale);
                            }

                            if (item.quantity == undefined || (item.quantity && item.quantity == '')) {
                                itemError["quantity"] = "quantity is required";
                                item.quantity = 0;
                            }
                            else if (parseInt(item.quantity) <= 0) {
                                itemError["quantity"] = "quantity must be greater than 0";
                            } 
                            
                            if (item.discount1 == undefined || (item.discount1 && item.discount1 == '')) {
                                itemError["discount1"] = "discount1 is required";
                                item.discount1 = 0;
                            }
                            else if (parseInt(item.discount1) <= 0) {
                                itemError["discount1"] = "discount1 must be greater than 0";
                            } 
                            
                            if (item.discount2 == undefined || (item.discount2 && item.discount2 == '')) {
                                itemError["discount2"] = "discount2 is required";
                                item.discount2 = 0;
                            }
                            else if (parseInt(item.discount2) <= 0) {
                                itemError["discount2"] = "discount2 must be greater than 0";
                            } 
                            
                            if (item.discountNominal == undefined || (item.discountNominal && item.discountNominal == '')) {
                                itemError["discountNominal"] = "discountNominal is required";
                                item.discountNominal = 0;
                            }
                            else if (parseInt(item.discountNominal) <= 0) {
                                itemError["discountNominal"] = "discountNominal must be greater than 0";
                            } 
                            
                            if (item.margin == undefined || (item.margin && item.margin == '')) {
                                itemError["margin"] = "margin is required";
                                item.margin = 0;
                            }
                            else if (parseInt(item.margin) <= 0) {
                                itemError["margin"] = "margin must be greater than 0";
                            } 
                            
                            if (item.specialDiscount == undefined || (item.specialDiscount && item.specialDiscount == '')) {
                                itemError["specialDiscount"] = "specialDiscount is required";
                                item.margin = 0;
                            }
                            else if (parseInt(item.specialDiscount) <= 0) {
                                itemError["specialDiscount"] = "specialDiscount must be greater than 0";
                            } 
                            
                            item.total = 0;
                            if(parseInt(item.quantity) > 0) {
                                //Price
                                item.total = parseInt(item.quantity) * parseInt(item.price);
                                //Diskon
                                item.total = (item.total * (1 - (parseInt(item.discount1) / 100)) * (1 - (parseInt(item.discount2) / 100))) - parseInt(item.discountNominal);
                                //Spesial Diskon 
                                item.total = item.total * (1 - (parseInt(item.specialDiscount) / 100))
                                //Margin
                                item.total = item.total * (1 - (parseInt(item.margin) / 100))
                            }  
                            valid.subTotal = parseInt(valid.subTotal) + parseInt(item.total);
                            valid.totalProduct = parseInt(valid.totalProduct) + parseInt(item.quantity);
                            itemErrors.push(itemError);
                        }
                        var totalDiscount = parseInt(valid.subTotal) * parseInt(valid.discount) / 100;
                        var totalVoucher = 0;
                        valid.grandTotal = parseInt(valid.subTotal) - parseInt(totalDiscount) - parseInt(totalVoucher);
                        
                        for (var itemError of itemErrors) {
                            for (var prop in itemError) {
                                errors.items = itemErrors;
                                break;
                            }
                            if (errors.items)
                                break;
                        }
                    } 
                    
                    if (!_paymentType) {
                        paymentDetailError["paymentTypeId"] = "paymentTypeId not found";
                    }
                    else {
                        valid.paymentDetail.paymentTypeId = _paymentType._id;
                        valid.paymentDetail.paymentType = _paymentType;
                        
                        if(_paymentType.name.toLowerCase() == "card" || _paymentType.name.toLowerCase() == "partial"){
                            if (!payment.paymentDetail.bankId || payment.paymentDetail.bankId == '')
                                paymentDetailError["bankId"] = "bankId is required";
                            if (!_bank) {
                                paymentDetailError["bankId"] = "bankId not found";
                            }
                            else {
                                valid.paymentDetail.bankId = _bank._id;
                                valid.paymentDetail.bank = _bank;
                            } 
                            
                            if (!valid.paymentDetail.card || valid.paymentDetail.card == '')
                                paymentDetailError["card"] = "card is required";
                            else {
                                if(valid.paymentDetail.card.toLowerCase() != 'debit' && valid.paymentDetail.card.toLowerCase() != 'credit')
                                    paymentDetailError["card"] = "card must be debit or credit"; 
                                else { 
                                    if(valid.paymentDetail.card.toLowerCase() != 'debit')
                                    {
                                        if (!payment.paymentDetail.cardTypeId || payment.paymentDetail.cardTypeId == '')
                                            paymentDetailError["cardTypeId"] = "cardTypeId is required"; 
                                        if (!_cardType) {
                                            paymentDetailError["cardTypeId"] = "cardTypeId not found";
                                        }
                                        else {
                                            valid.paymentDetail.cardTypeId = _cardType._id;
                                            valid.paymentDetail.cardType = _cardType;
                                        }   
                                    }
                                }
                            }
                                
                            if (!valid.paymentDetail.cardNumber || valid.paymentDetail.cardNumber == '')
                                paymentDetailError["cardNumber"] = "cardNumber is required";
                                
                            if (!valid.paymentDetail.cardName || valid.paymentDetail.cardName == '')
                                paymentDetailError["cardName"] = "cardName is required"; 
                                
                            if (valid.paymentDetail.cardAmount == undefined || (valid.paymentDetail.cardAmount && valid.paymentDetail.cardAmount == '')) {
                                paymentDetailError["cardAmount"] = "cardAmount is required";
                                valid.paymentDetail.cardAmount = 0;
                            } 
                            else if(parseInt(valid.paymentDetail.cardAmount) <= 0) {
                                paymentDetailError["cardAmount"] = "cardAmount must be greater than 0";
                            }  
                        }  
                        
                        if(_paymentType.name.toLowerCase() == "cash" || _paymentType.name.toLowerCase() == "partial"){ 
                            if (valid.paymentDetail.cashAmount == undefined || (valid.paymentDetail.cashAmount && valid.paymentDetail.cashAmount == '')) {
                                paymentDetailError["cashAmount"] = "cashAmount is required";
                                valid.paymentDetail.cashAmount = 0;
                            } 
                            else if(parseInt(valid.paymentDetail.cashAmount) <= 0) {
                                paymentDetailError["cashAmount"] = "cashAmount must be greater than 0";
                            } 
                        } 
                        
                        if(_paymentType.name.toLowerCase() == "partial")
                            if((parseInt(valid.paymentDetail.cashAmount) + parseInt(valid.paymentDetail.cardAmount)) < parseInt(valid.grandTotal))
                                errors["grandTotal"] = "grandTotal is bigger than payment";  
                                
                        if(_paymentType.name.toLowerCase() == "card")
                            if(parseInt(valid.paymentDetail.cardAmount) < parseInt(valid.grandTotal))
                                errors["grandTotal"] = "grandTotal is bigger than payment";  
                                
                        if(_paymentType.name.toLowerCase() == "cash")
                            if(parseInt(valid.paymentDetail.cashAmount) < parseInt(valid.grandTotal))
                                errors["grandTotal"] = "grandTotal is bigger than payment";  
                    } 
                    
                    for (var prop in paymentDetailError) {
                        errors["paymentDetail"] = paymentDetailError;
                        break;
                    }
            
                    for (var prop in errors) {
                        var ValidationError = require('../../validation-error');
                        reject(new ValidationError('data does not pass validation', errors));
                    }

                    valid = new Payment(valid);
                    valid.stamp(this.user.username, 'manager');
                    resolve(valid);
                })
                .catch(e => { 
                    for (var prop in errors) {
                        var ValidationError = require('../../validation-error');
                        reject(new ValidationError('data does not pass validation', errors));
                    } 
                    reject(e);
                })
        });
    }
};