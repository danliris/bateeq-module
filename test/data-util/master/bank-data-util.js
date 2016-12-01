"use strict";
var _getSert = require("./getsert");
var generateCode = require("../../../src/utils/code-generator");

class BankDataUtil {
    getSert(input) {
        var ManagerType = require("../../../src/managers/master/bank-manager");
        return _getSert(input, ManagerType, (data) => {
            return {
                code: data.code
            };
        });
    }

    getNewData() {
    var Bank = require("bateeq-models").master.Bank;
    var bank = new Bank();

    var now = new Date();
    // var stamp = now / 1000 | 0;
    var code = generateCode();

    bank.code = code;
    bank.name = `name[${code}]`;
    bank.description = `description for ${code}`; 

    return Promise.resolve(bank);
    }
}
module.exports = new BankDataUtil();