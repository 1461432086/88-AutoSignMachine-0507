const {
    RSAUtils
} = require('./RSAUtils');
const {
    appInfo,
    buildUnicomUserAgent
} = require('../../../utils/device')
const {
    default: PQueue
} = require('p-queue');
const transParams = (data) => {
    let params = new URLSearchParams();
    for (let item in data) {
        params.append(item, data["" + item + ""]);
    }
    return params;
};

var dailyBookRead1GFlowTask = {
    login: async (axios, options) => {
        const useragent = buildUnicomUserAgent(options, 'p')
        //密码加密
        var modulus = "00D9C7EE8B8C599CD75FC2629DBFC18625B677E6BA66E81102CF2D644A5C3550775163095A3AA7ED9091F0152A0B764EF8C301B63097495C7E4EA7CF2795029F61229828221B510AAE9A594CA002BA4F44CA7D1196697AEB833FD95F2FA6A5B9C2C0C44220E1761B4AB1A1520612754E94C55DC097D02C2157A8E8F159232ABC87";
        var exponent = "010001";
        var key = RSAUtils.getKeyPair(exponent, '', modulus);
        let phonenum = RSAUtils.encryptedString(key, options.user);

        let {
            config: st_config
        } = await axios.request({
            headers: {
                "user-agent": useragent,
                "X-Requested-With": "XMLHttpRequest"
            },
            url: `http://st.woread.com.cn/touchextenernal/common/shouTingLogin.action`,
            method: 'POST',
            data: transParams({
                phonenum
            })
        })
        let jar = st_config.jar
        let cookiesJson = jar.toJSON()
        let diwert = cookiesJson.cookies.find(i => i.key == 'diwert')
        let userAccount = cookiesJson.cookies.find(i => i.key == 'useraccount')
        if (!userAccount || !diwert) {
            throw new Error('获取用户信息失败')
        }
        return {
            jar
        }
    },
    getBookList: async (axios, options) => {
        let {
            jar
        } = await dailyBookRead1GFlowTask.login(axios, options)
        const useragent = buildUnicomUserAgent(options, 'p')
        let params = {
            "bindType": 1,
            "categoryindex": 119197,
            "curpage": 1,
            "limit": 10,
            "pageIndex": 11009,
            "cardid": 12595
        }
        let {
            data
        } = await axios.request({
            headers: {
                "user-agent": useragent,
                "referer": `https://st.woread.com.cn/touchextenernal/read/bookList.action`,
                "origin": "https://st.woread.com.cn",
                "X-Requested-With": "XMLHttpRequest",
            },
            url: `http://st.woread.com.cn/touchextenernal/read/getBookList.action`,
            method: 'post',
            data: transParams(params)
        })
        if (data.code === '0000') {
            return data.message;
        } else {
            console.error('获取小说列表失败')
            return [];
        }
    },
    doCheckRightOfGoldCoin: async (axios, options) => {
        const useragent = buildUnicomUserAgent(options, 'p')
        let {
            data
        } = await axios.request({
            headers: {
                "user-agent": useragent,
                "origin": "https://st.woread.com.cn",
                "X-Requested-With": "XMLHttpRequest"
            },
            url: `http://st.woread.com.cn/touchextenernal/readActivity/checkRightOfGoldCoin.action`,
            method: 'get'
        })

        if (data.code === '0000') {
            return data.message.daySurplus;
        } else {
            console.error("获取剩余阅读次数失败!使用默认值: 10");
            return 10;
        }
    },
    doSendRightOfGoldCoin: async (axios, options) => {
        const useragent = buildUnicomUserAgent(options, 'p')
        let {
            data
        } = await axios.request({
            headers: {
                "user-agent": useragent,
                "origin": "https://st.woread.com.cn",
                "X-Requested-With": "XMLHttpRequest"
            },
            url: `http://st.woread.com.cn/touchextenernal/readActivity/sendRightOfGoldCoin.action?userType=112_3001&homeArea=051&homeCity=540`,
            method: 'get'
        })
        console.reward('flow', '100m')
    },
    doUpdateReadTime: async (axios, options) => {
        let {
            cntindex,
            cntname
        } = options;
        console.info(cntname)

        const useragent = buildUnicomUserAgent(options, 'p')
        let params = {
            "cntindex": cntindex,
            "cntname": cntname,
            "time": 2
        }
        let n = 1;
        while (n <= 3) {
            console.info('第', n, '次')
            let {
                data
            } = await axios.request({
                headers: {
                    "user-agent": useragent,
                    "origin": "https://st.woread.com.cn",
                    "X-Requested-With": "XMLHttpRequest",
                },
                url: `http://st.woread.com.cn//touchextenernal/contentread/ajaxUpdatePersonReadtime.action`,
                method: 'post',
                data: transParams(params)

            })
            console.info("等待2分钟")
            await new Promise((resolve, reject) => setTimeout(resolve, 2 * (Math.floor(Math.random() * 10) + 60) * 1000))
            n++
        }

        await dailyBookRead1GFlowTask.doSendRightOfGoldCoin(axios, options);
    },
    doTask: async (axios, options) => {
        let books = await dailyBookRead1GFlowTask.getBookList(axios, options)
        let daySurplus = await dailyBookRead1GFlowTask.doCheckRightOfGoldCoin(axios, options)
        console.info("剩余未完成阅读", daySurplus)

        let queue = new PQueue({
            concurrency: 1
        });

        console.info('调度任务中', '并发数', 1)
        if (books.length > 0) {
            for (let i = books.length - daySurplus; i < books.length; i++) {
                let book = books[i];
                queue.add(async () => {
                    await dailyBookRead1GFlowTask.doUpdateReadTime(axios, {
                        ...options,
                        cntindex: book.cntindex,
                        cntname: book.cntname
                    })
                })
            }
        }

        await queue.onIdle()
    }
}

module.exports = dailyBookRead1GFlowTask