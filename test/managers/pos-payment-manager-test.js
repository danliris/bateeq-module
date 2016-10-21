var should = require('should');
var helper = require('../helper');
var manager;
var testData;

function getData() {
    var store = testData.stores["ST-FNG"]; 
    var bank = testData.banks["BA-BCA"];                    //BCA, MANDIRI, BRI, dkk
    var cardType = testData.cardTypes["CT-VISA"];           //CARD, MASTERCARD, VISA
    var paymentType = testData.paymentTypes["PA-CARD"];     //CASH, CARD, PARTIAL
    var variant = testData.variants["UT-AV1"];
 
    var Payment = require('bateeq-models').pos.Payment;
    var PaymentItem = require('bateeq-models').pos.PaymentItem;
    var PaymentDetail = require('bateeq-models').pos.PaymentDetail;
    var payment = new Payment();

    var now = new Date();
    var stamp = now / 1000 | 0;
    var code = stamp.toString(36);

    payment.code = code;
    payment.date = now;
    payment.discount = 0;
    payment.reference = '';
    payment.remark = '';
    
    payment.storeId = store._id;
    payment.store = store;  

    payment.items.push(new PaymentItem({
        articleVariantId: variant._id,
        articleVariant: variant,
        quantity: 1,
        price: 100000,
        discount1: 0,
        discount2: 0,
        margin: 0,
        specialDiscount: 0,
        total: 100000
    }));
    
    var paymentTotal = 0;
    for(var i of payment.items) {
        paymentTotal += i.total;
    }

    payment.paymentDetail = new PaymentDetail({
        paymentTypeId : paymentType._id,
        paymentType : paymentType,
        voucherId : {},
        voucher : {},
        bankId : bank._id,
        bank : bank,
        cardTypeId : cardType._id,
        cardType : cardType,                
        card : 'Credit', //Debit | Credit
        cardNumber : '1000200030004000',
        cardName : 'CardName',
        cashAmount : 0,
        cardAmount : paymentTotal
    })
    return payment;
}  

before('#00. connect db', function(done) {
    helper.getDb()
        .then(db => {
            var data = require("../data");
            data(db)
                .then(result => { 
                    var PaymentManager = require('../../src/managers/pos/pos-payment-doc-manager');
                    manager = new PaymentManager(db, {
                        username: 'unit-test'
                    });
                    testData = result; 
                    done();
                });
        })
        .catch(e => {
            done(e);
        });
});

var createdId;
var createdData;
it('#01. should success when create new data Cash Payment Type', function(done) {
    var data = getData();
    manager.create(data)
        .then(id => {
            id.should.be.Object();
            createdId = id;
            done();
        })
        .catch(e => {
            done(e);
        });
});

it(`#02. should success when get created data with id Cash Payment Type`, function(done) {
    manager.getSingleByQuery({
            _id: createdId
        })
        .then(data => {
            createdData = data;
            done();
        })
        .catch(e => {
            done(e);
        })
});

it(`#03. should success when update created data Cash Payment Type`, function(done) {  
    createdData.remark += '[updated]';  
    manager.update(createdData)
        .then(id => {
            createdId.toString().should.equal(id.toString());
            done();
        })
        .catch(e => {
            done(e);
        });
});

it(`#04. should success when get updated data with id Cash Payment Type`, function(done) {
    manager.getSingleByQuery({
            _id: createdId
        })
        .then(data => { 
            data.remark.should.equal(createdData.remark); 
            data.items.length.should.equal(1);
            done();
        })
        .catch(e => {
            done(e);
        })
});

it(`#05. should success when delete data Cash Payment Type`, function(done) {
    manager.delete(createdData)
        .then(id => {
            createdId.toString().should.equal(id.toString());
            done();
        })
        .catch(e => {
            done(e);
        });
});

it(`#06. should _deleted=true Cash Payment Type`, function(done) {
    manager.getSingleByQuery({
            _id: createdId
        })
        .then(data => { 
            data._deleted.should.be.Boolean();
            data._deleted.should.equal(true);
            done();
        })
        .catch(e => {
            done(e);
        })
});

// it('#07. should error when create new data with same code Cash Payment Type', function(done) {
//     var data = Object.assign({}, createdData);
//     delete data._id;
//     manager.create(data)
//         .then(id => {
//             id.should.be.Object();
//             createdId = id;
//             done("Should not be able to create data with same code Cash Payment Type");
//         })
//         .catch(e => {
//             try {
//                 e.errors.should.have.property('code');
//                 done();
//             }
//             catch (xe) {
//                 done(xe);
//             };
//         })
// }); 