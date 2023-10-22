/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2018-2023 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const moment = require('moment');

function getActivity(req, res, next) {
    const result = {};
    const stor = req.app.term.Storage;
    const page = req.params.page || 1;
    const pageSize = 25;
    stor.Activity.count().then(count => {
        result.count = count;
        result.items = [];
        let offset = (page - 1) * pageSize;
        stor.Activity.findAll({
            order: [['time', 'DESC']],
            offset: offset,
            limit: pageSize
        })
        .then(results => {
            results.forEach(activity => {
                offset++;
                result.items.push({
                    nr: offset,
                    hash: activity.hash,
                    origin: activity.imsi,
                    type: activity.type,
                    address: activity.address,
                    data: activity.data,
                    status: activity.status,
                    time: moment(activity.time).format('DD MMM YYYY HH:mm')
                });
            });
            // create pagination
            result.pages = req.app.locals.pager(result.count, pageSize, page);
            // send content
            res.json(result);
        });
    });
}

function getLog(req, res, next) {
    const result = {};
    const term = req.app.term;
    if (req.params.term) {
        const gsm = term.Pool.get(req.params.term);
        if (gsm) {
            // send content
            result.time = Date.now();
            result.logs = fs.readFileSync(gsm.logfile).toString();
        }
    }
    res.json(result);
}

function getActivityLog(req, res, next) {
    const term = req.app.term;
    const result = {
        time: Date.now(),
        logs: fs.readFileSync(term.logfile).toString()
    }
    res.json(result);
}

/* GET home page. */
router.get('/', (req, res, next) => {
    res.render('index/index', {
        title: 'Dashboard',
        sockaddress: `${req.protocol}://${req.get('host')}/ui`
    });
});

router.get('/about', (req, res, next) => {
    let about;
    if (req.app.about) {
        about = req.app.about;
    } else {
        const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
        about = {
            title: packageInfo.description,
            version: packageInfo.version,
            author: packageInfo.author.name ? packageInfo.author.name + ' <' + packageInfo.author.email + '>' : packageInfo.author,
            license: packageInfo.license
        }
    }
    res.json(about);
});

router.get('/activity', (req, res, next) => {
    getActivity(req, res, next);
});

router.get('/activity/:page', (req, res, next) => {
    getActivity(req, res, next);
});

router.get('/log/:term', (req, res, next) => {
    getLog(req, res, next);
});

router.get('/activity-log', (req, res, next) => {
    getActivityLog(req, res, next);
});

router.get('/client', (req, res, next) => {
    const result = [];
    const term = req.app.term;
    let nr = 0;
    term.clients.forEach(socket => {
        const info = {
            nr: ++nr,
            id: socket.id,
            address: socket.handshake.address,
            time: socket.time ? moment(socket.time).format('DD MMM YYYY HH:mm') : null
        }
        result.push(info);
    });
    res.json({count: result.length, items: result});
});

router.post('/:term/at', (req, res, next) => {
    const result = {success: false};
    if (req.params.term && req.body.command) {
        const term = req.app.term;
        const terminal = term.get(req.params.term);
        if (terminal) {
            terminal.query(req.body.command)
                .then(retval => {
                    result.success = true;
                    if (retval) {
                        result.data = JSON.stringify(retval);
                    }
                    res.json(result);
                })
                .catch(err => {
                    if (err instanceof Error) {
                        result.data = err.message;
                    } else {
                        result.data = err;
                    }
                    res.json(result);
                })
            ;
        } else {
            res.json(result);
        }
    } else {
        next();
    }
});

module.exports = router;
