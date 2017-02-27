'use strict'

// external deps 
var ObjectId = require("mongodb").ObjectId;
var BaseManager = require('module-toolkit').BaseManager;
var moment = require("moment");

var ItemManager = require('../../src/managers/master/item-manager');
var BankManager = require('../../src/managers/master/bank-manager');
var CardTypeManager = require('../../src/managers/master/card-type-manager');
var StoreManager = require('../../src/managers/master/store-manager');
var SalesManager = require('../../src/managers/sales/sales-manager');

// internal deps 
require('mongodb-toolkit');
const migrationName = "ETL-FactPenjualan-Summary";

module.exports = class FactPenjualanSummary {
    constructor(db, user, sql) {
        this.db = db;
        this.sql = sql;
        this.SalesManager = new SalesManager(db, user);
        this.migrationLog = db.collection("migration.log");
    }

    run() {
        var startedDate = new Date();
        return new Promise((resolve, reject) => {
            this.lastETLDate().then(lastMigration => {

                this.migrationLog.insert({
                    migration: migrationName,
                    _start: startedDate,
                    _createdDate: startedDate
                })

                this.extract(lastMigration._createdDate)
                    .then((data) => {
                        var exctractDate = new Date();
                        console.log("extract :" + moment(exctractDate).diff(moment(startedDate), "minutes") + " minutes")
                        this.transform(data).then((data) => {
                            var transformDate = new Date();
                            console.log("transform :" + moment(transformDate).diff(moment(exctractDate), "minutes") + " minutes")
                            this.load(data).then((result) => {
                                var finishedDate = new Date();
                                var spentTime = moment(finishedDate).diff(moment(startedDate), "minutes");
                                console.log("load :" + spentTime + " minutes")
                                var updateLog = {
                                    migration: migrationName,
                                    _start: startedDate,
                                    _createdDate: startedDate,
                                    _end: finishedDate,
                                    executionTime: spentTime + " minutes",
                                    status: "success",
                                    summary: {
                                        extract: moment(exctractDate).diff(moment(startedDate), "minutes") + " minutes",
                                        transform: moment(transformDate).diff(moment(exctractDate), "minutes") + " minutes",
                                        load: spentTime + " minutes"
                                    }
                                };
                                this.migrationLog.updateOne({ _createdDate: startedDate }, updateLog);
                                resolve(result);
                            })
                                .catch((err) => {
                                    var finishedDate = new Date();
                                    var spentTime = moment(finishedDate).diff(moment(startedDate), "minutes");
                                    var updateLog = {
                                        migration: migrationName,
                                        _start: startedDate,
                                        _createdDate: startedDate,
                                        _end: finishedDate,
                                        executionTime: spentTime + " minutes",
                                        status: err
                                    };
                                    this.migrationLog.updateOne({ _createdDate: startedDate }, updateLog);
                                    console.log(err);
                                    reject(err);
                                });
                        }).catch((err) => {
                            var finishedDate = new Date();
                            var spentTime = moment(finishedDate).diff(moment(startedDate), "minutes");
                            var updateLog = {
                                migration: migrationName,
                                _start: startedDate,
                                _createdDate: startedDate,
                                _end: finishedDate,
                                executionTime: spentTime + " minutes",
                                status: err
                            };
                            this.migrationLog.updateOne({ _createdDate: startedDate }, updateLog);
                            console.log(err);
                            reject(err);
                        });
                    }).catch((err) => {
                        var finishedDate = new Date();
                        var spentTime = moment(finishedDate).diff(moment(startedDate), "minutes");
                        var updateLog = {
                            migration: migrationName,
                            _start: startedDate,
                            _createdDate: startedDate,
                            _end: finishedDate,
                            executionTime: spentTime + " minutes",
                            status: err
                        };
                        this.migrationLog.updateOne({ _createdDate: startedDate }, updateLog);
                        console.log(err);
                        reject(err);
                    });
            })
        });
    }

    lastETLDate() {
        return new Promise((resolve, reject) => {
            this.migrationLog.find({ "migration": migrationName, status: "success" }).sort({ "_createdDate": -1 }).limit(1).toArray()
                .then((result) => {
                    resolve(result[0] || { _createdDate: new Date("1970-01-01") });
                }).catch((err) => {
                    reject(err);
                })
        })
    }


    extract(date) {
        var timestamp = date || new Date("1970-01-01");
        return this.SalesManager.collection.find({
            _deleted: false,
            _updatedDate: {
                "$gt": timestamp
            }
        }).toArray();
    }

    getDBValidString(str) {
        if (str) {
            if ((typeof str) == "string")
                return str.split("'").join("''")
            else
                return str
        }
        else {
            if ((typeof str) == "number")
                return "0";
            else
                return ""
        }
    }

    getArticles() {
        return new Promise((resolve, reject) => {
            var motifs = this.db.collection("article-motifs").find({}).toArray();
            var subcounters = this.db.collection("article-sub-counters").find({}).toArray();
            var counters = this.db.collection("article-counters").find({}).toArray();
            var materials = this.db.collection("article-materials").find({}).toArray();
            var sizes = this.db.collection("article-sizes").find({}).toArray();

            Promise.all([motifs, subcounters, counters, materials, sizes])
                .then((results) => {
                    if (results[0])
                        this.motifs = results[0];
                    if (results[1])
                        this.subcounters = results[1];
                    if (results[2])
                        this.counters = results[2];
                    if (results[3])
                        this.materials = results[3];
                    if (results[4])
                        this.sizes = results[4];
                    resolve(true);
                })
                .catch((error) => {
                    reject(error);
                })
        });
    }

    sumMainSalesPrice(sale) {
        var sum = 0;
        for (var item of sale.items) {
            sum += (parseInt(item.item.domesticCOGS || 0) * parseInt(item.quantity));
        }
        return sum;
    }

    getExcludedItem() {
        return new Promise((resolve, reject) => {
            this.db.collection("migration-excluded-items").find({ _deleted: false }).toArray()
                .then((result) => {
                    resolve(result);
                }).catch((error) => {
                    reject(error);
                })
        });
    }

    isExcludedItemOnly(sale) {
        var find = sale.items.find((x) => this.excludedItem.indexOf(x.item.code) == -1);
        return !find;
    }

    transform(data) {
        return new Promise((resolve, reject) => {
            this.getExcludedItem().then((excluded) => {
                this.excludedItem = (excluded) ? excluded.map((o) => o.code) : [];
                var result = data.map((sale) => {
                    if (!this.isExcludedItemOnly(sale))
                        return {
                            timekey: `'${moment(sale.date).format("L")}'`,
                            countdays: `'${moment(sale.date).daysInMonth()}'`,
                            store_code: sale.store ? `'${this.getDBValidString(sale.store.code)}'` : null,
                            hd_transaction_number: `'${this.getDBValidString(sale.code)}'`,
                            hd_sales_discount_percentage: `'${this.getDBValidString(sale.discount)}'`,
                            hd_grandtotal: `'${this.getDBValidString(sale.grandTotal)}'`,
                            hd_payment_type: `'${this.getDBValidString(sale.salesDetail.paymentType)}'`,
                            hd_card: `'${this.getDBValidString(sale.salesDetail.card)}'`,
                            hd_card_type: `'${this.getDBValidString(sale.salesDetail.cardType.name)}'`,
                            hd_bank_name: `'${this.getDBValidString((!sale.salesDetail.bank.name || sale.salesDetail.bank.name == "-") ? "" : sale.salesDetail.bank.name)}'`,
                            hd_card_number: `'${this.getDBValidString(sale.salesDetail.cardNumber)}'`,
                            hd_voucher_amount: sale.salesDetail.voucher ? `'${this.getDBValidString(sale.salesDetail.voucher.value)}'` : `'0'`,
                            hd_cash_amount: sale.salesDetail.cashAmount ? `'${this.getDBValidString(sale.salesDetail.cashAmount)}'` : `'0'`,
                            hd_card_amount: sale.salesDetail.cardAmount ? `'${this.getDBValidString(sale.salesDetail.cardAmount)}'` : `'0'`,
                            store_name: `'${this.getDBValidString(sale.store.name)}'`,
                            store_city: `'${this.getDBValidString(sale.store.city)}'`,
                            store_open_date: sale.store.openedDate ? `'${moment(sale.store.openedDate).format("L")}'` : null,
                            store_close_date: sale.store.closedDate ? `'${moment(sale.store.closedDate).format("L")}'` : null,
                            store_area: `'${this.getDBValidString(sale.store.storeArea)}'`,
                            store_status: `'${this.getDBValidString(sale.store.status)}'`,
                            store_wide: `'${this.getDBValidString(sale.store.storeWide)}'`,
                            store_offline_online: `'${this.getDBValidString(sale.store['online-offline'])}'`,
                            store_sales_category: `'${this.getDBValidString(sale.store.salesCategory)}'`,
                            store_monthly_total_cost: `'${this.getDBValidString(sale.store.monthlyTotalCost)}'`,
                            store_category: `'${this.getDBValidString(sale.store.storeCategory)}'`,
                            store_montly_omzet_target: `'${this.getDBValidString(sale.store.salesTarget)}'`,
                            total_qty: `'${this.getDBValidString(sale.totalProduct)}'`,
                            hd_pos: `'${this.getDBValidString(sale.pos)}'`,
                            hd_bank_card: `'${this.getDBValidString((!sale.salesDetail.bankCard.name || sale.salesDetail.bankCard.name == "-") ? "" : sale.salesDetail.bankCard.name)}'`,
                            mainsalesprice: `'${this.getDBValidString(this.sumMainSalesPrice(sale))}'`,
                            hd_is_void: `'${sale.isVoid ? 1 : 0}'`
                        }
                });
                resolve([].concat.apply([], result));
            });
        });
    }


    insertQuery(sql, query) {
        return new Promise((resolve, reject) => {
            sql.query(query, function (err, result) {
                if (err) {
                    resolve({ "status": "error", "error": err });
                } else {
                    resolve({ "status": "success" });
                }
            })
        })
    }

    load(data) {
        return new Promise((resolve, reject) => {
            this.sql.startConnection()
                .then(() => {

                    var transaction = this.sql.transaction();

                    transaction.begin((err) => {

                        var request = this.sql.transactionRequest(transaction);

                        var command = [];

                        var sqlQuery = '';

                        var count = 1;

                        for (var item of data) {
                            if (item) {
                                var queryString = `INSERT INTO [BTQ_FactPenjualanSummary_Temp] ([timekey],[countdays],[store_code],[hd_transaction_number],[hd_sales_discount_percentage],[hd_grandtotal],[hd_payment_type],[hd_card],[hd_card_type],[hd_bank_name],[hd_card_number],[hd_voucher_amount],[hd_cash_amount],[hd_card_amount],[store_name],[store_city],[store_open_date],[store_close_date],[store_area],[store_status],[store_wide],[store_offline_online],[store_sales_category],[store_monthly_total_cost],[store_category],[store_montly_omzet_target],[total_qty],[hd_pos],[hd_bank_card],[mainsalesprice],[hd_is_void]) values(${item.timekey},${item.countdays},${item.store_code},${item.hd_transaction_number},${item.hd_sales_discount_percentage},${item.hd_grandtotal},${item.hd_payment_type},${item.hd_card},${item.hd_card_type},${item.hd_bank_name},${item.hd_card_number},${item.hd_voucher_amount},${item.hd_cash_amount},${item.hd_card_amount},${item.store_name},${item.store_city},${item.store_open_date},${item.store_close_date},${item.store_area},${item.store_status},${item.store_wide},${item.store_offline_online},${item.store_sales_category},${item.store_monthly_total_cost},${item.store_category},${item.store_montly_omzet_target},${item.total_qty},${item.hd_pos},${item.hd_bank_card},${item.mainsalesprice},${item.hd_is_void})\n`;
                                sqlQuery = sqlQuery.concat(queryString);
                                if (count % 1000 == 0) {
                                    command.push(this.insertQuery(request, sqlQuery));
                                    sqlQuery = "";
                                }
                                // console.log(`add data to query  : ${count}`);
                                count++;
                            }
                        }

                        if (sqlQuery != "")
                            command.push(this.insertQuery(request, `${sqlQuery}`));

                        request.multiple = true;

                        // var fs = require("fs");
                        // var path = "C:\\Users\\daniel.nababan.MOONLAY\\Desktop\\sqlQuery.txt";

                        // fs.writeFile(path, test, function (error) {
                        //     if (error) {
                        //         console.log("write error:  " + error.message);
                        //     } else {
                        //         console.log("Successful Write to " + path);
                        //     }
                        // });

                        return Promise.all(command)
                            .then((results) => {
                                if (results.find((o) => o.status == "error")) {
                                    transaction.rollback((err) => {
                                        if (err)
                                            reject(err)
                                        else
                                            reject(results);
                                    });
                                } else {
                                    request.execute("BTQ_Upsert_FactPenjualanSummary").then((execResult) => {
                                        transaction.commit((err) => {
                                            if (err)
                                                reject(err);
                                            else
                                                resolve(results);
                                        });
                                    }).catch((error) => {
                                        transaction.rollback((err) => {
                                            if (err)
                                                reject(err)
                                            else
                                                reject(error);
                                        });
                                    })
                                }
                            })
                            .catch((error) => {
                                transaction.rollback((err) => {
                                    if (err)
                                        reject(err)
                                    else
                                        reject(error);
                                });
                            });
                    });
                })
                .catch((err) => {
                    reject(err);
                })
        });
    }
}
