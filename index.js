const HyperExpress = require('hyper-express');

const https = require('https');
const http = require('http');

/**
 * @description
 * @param {string} url
 * @param {*} opts
 * @returns {Promise<{headers: {}, status: number, body: Stream}>}
 */
async function webRequest(url, opts) {
    let whoToCall = http;
    if (url.startsWith('https')) {
        whoToCall = https;
    }
    let output = {
        status: 200,
        headers: {},
        body: undefined,
    }

    let headers = { ...opts.headers };
    opts = { ...opts, headers: headers }
    delete headers.host;

    return new Promise((res, rej) => {
        const temp = whoToCall.request(url, opts, (response) => {
            output.status = response.statusCode;
            output.headers = response.headers;
            output.stream = response;
            res(output);
        })
        temp.on('error', rej);
        if (opts.body) {
            temp.write(opts.body);
        }
    })
}


async function main() {
    const fetch = (await import('node-fetch')).default

    const webserver = new HyperExpress.Server();
    const port = 4242;

    /**
     * @description
     * @param {string} url
     * @returns {boolean} 
     */
    function shouldBeCached(url) {
        if (
            url.includes('.css')
            || url.includes('.min.js')
            || url.includes('.js')
            || url.includes('.jpg')
            || url.includes('.png')
            || url.includes('.gif')
            || url.includes('.ico')
            || url.includes('.webp')
        ) {
            return true;
        }
        return false;
    }

    function shouldAvoid(url) {
        if (url.includes('cdn-cgi/challenge-platform')) {
            return true;
        }
        return false;
    }

    const target = "ogamex.net"

    const cached = {};

    const defaultOutput = {
        status: 500,
        headers: {},
        body: '!!! Error !!!',
    };

    // Create GET route to serve 'Hello World'
    webserver.use(async (request, response) => {
        const url = `https://${request.hostname.replace('localhost', target)}${request.url}`
        // console.log(url)


        let output = defaultOutput;
        if (cached[url]) {
            output = cached[url];
        } else if (!shouldAvoid(url)) {
            let newHeaders = { ...request.headers };
            delete newHeaders.host;
            newHeaders.cookie = require('./secret');
            let body = await request.buffer()
            let temp = await fetch(url, {
                method: request.method,
                headers: newHeaders,
                redirect: 'follow',
                body: request.method !== 'GET' ? body : undefined,
            }).catch((e) => {
                // console.warn(e);
                return defaultOutput;
            });
            output = {
                status: temp.status,
                headers: temp.headers,
                body: '',
            }
            try {
                output.body = await temp.arrayBuffer();
            } catch (e) {
                //
                output.body = '! ERROR !'
            }
            // cache ?!
            if (shouldBeCached(url)) {
                output.headers['cache-control']='max-age=30000';
                if (request.method === 'GET' || request.method === 'HEAD') {
                    cached[url] = output;
                }
            } else {
                // console.log("Will not cache : " + url)
            }
        }

        response.status(output.status);
        let setCookie = output.headers['set-cookie'];
        if (setCookie) {
            setCookie.forEach((line) => {
                let path = '/';
                let httpOnly = line.includes('HttpOnly');
                let name = line.split('=')[0]
                let value = line.split('=')[1].split(';')[0]
                let expiry = new Date(line.split('expires=')[1].split(';')[0]).getTime() - Date.now();
                response.cookie(name, value, expiry,
                    {
                        httpOnly,
                        path
                    });
            })
        }
        response.setHeaders(output.headers);
        response.send(output.body);
    })

    // Activate webserver by calling .listen(port, callback);
    webserver.listen(port)
        .then((socket) => {
            console.log(`Webserver started on port ${port}`)
        })
        .catch((error) => console.log(`Failed : Webserver can't start on port ${port}`));
}

main();