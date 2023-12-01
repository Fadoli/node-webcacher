const HyperExpress = require('hyper-express');

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