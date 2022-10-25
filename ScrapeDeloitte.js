// TODO: time check or switch to diffent pages

const puppeteer = require('puppeteer-core');
const chrome = require('chrome-aws-lambda');
const {uploadScreenshot} = require('./utilities');
const fns = require('date-fns');
const hashId = require('./hash')
const fs = require('fs');
// Set website you want to screenshot
const url = "https://deloitte.wintalent.cn/wt/Deloitte/web/index#/";
const folder = './DeloitteScreenShot';  
const path1 = './DeloitteScreenShot/Internship';
const path2 = './DeloitteScreenShot/Graduate';    

// if (!fs.existsSync(folder)) {
//     fs.mkdirSync(folder);
//     console.log('Create a new Folder');
// }
// if (!fs.existsSync(path1)) {
//     fs.mkdirSync(path1);
// }
// if (!fs.existsSync(path2)) {
//     fs.mkdirSync(path2);
// }

const companyId = 'DELOITTE';
const companyName = 'Deloitte';
var JobObjs = new Array();

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

const ScrapeDeloitte = async (path,isFullTime) => {
    const browser = await puppeteer.launch({
        executablePath: await chrome.executablePath,
        args: [...chrome.args, "--disable-web-security"]});
    const page = await browser.newPage(); 
    await page.goto(url, { 
      waitUntil: ['domcontentloaded', 'networkidle2'], 
      timeout: 0 
    }); 
    await page.setViewport({ width: 1366, height: 768});
    await page.waitForTimeout(3000);
    if (isFullTime == true){
        //click Graduates button
        await page.evaluate(() =>
            document.getElementById("1").click()
        );
        await page.waitForTimeout(2000);

        //click Hong Kong 
        await page.evaluate(() =>
            document.querySelector(".main-right-t-m-r").firstElementChild.childNodes[12].click()
        );
        await page.waitForTimeout(2000);
    }
    else {
        //click Student button
        await page.evaluate(() =>
            document.getElementById("12").click()
        );
        await page.waitForTimeout(2000);

        //click Hong Kong 
        await page.evaluate(() =>
            document.querySelector(".main-right-t-m-r").firstElementChild.childNodes[12].click()
        );
        await page.waitForTimeout(2000);
    }

    var postion_information = new Array();
    var position_count = 0;

    // every time open a new tab we execute
    browser.on('targetcreated', async (target) => {
        const newTarget = await target.page();
        await newTarget.setViewport({ width: 1366, height: 768});
        await newTarget.bringToFront();
        await newTarget.waitForTimeout(3000);

        // get position name
        var postion_name = await newTarget.evaluate(() => {
            var temp_selector = document.querySelector(".content-position-detail-header-row-item");
            if (temp_selector != null){
                var temp_name = document.querySelector(".content-position-detail-header-row-item").textContent;
                return temp_name;
            }
            else return "cannot catch postion name";
        });
        postion_name = replaceAll(postion_name,'\n','')
        postion_name = replaceAll(postion_name,'  ','')
        //console.log(postion_name);

        // get url
        var url = newTarget.url();

        // get position location
        var postion_location = await newTarget.evaluate(() => {
            var temp_location = document.querySelectorAll(".content-position-detail-body-column")[1];
            var box = [
            temp_location.getBoundingClientRect()['x'],
            temp_location.getBoundingClientRect()['y'],
            temp_location.getBoundingClientRect()['width'],
            temp_location.getBoundingClientRect()['height'],];
            return box;
        });
        postion_information[position_count++] = [postion_name, postion_location, url];
        const image = await newTarget.screenshot({ encoding:"base64" , 'clip': 
        {
            'x': postion_location[0], 
            'y': postion_location[1],
            'width': postion_location[2], 
            'height': postion_location[3]
        }});
        await uploadScreenshot(image, path + '/Deloitte-' + hashId(postion_name) + '.png');

        await newTarget.close();
    })

    //get total page
    var page_number = await page.evaluate(() =>{
        return document.getElementsByClassName("page-b-m ng-binding")[0].textContent.split("Total")[1].split("Page")[0];
    });

    var post_date = new Array();
    var t_post_date = new Array();
    var post_date_count = 0;
    
    for (let p = 1; p <= parseInt(page_number); ++p){
        //get position number
        var postion_number = await page.evaluate(() =>{
            return document.querySelector(".table-b").rows.length - 1;
        });
        for (let i = 1; i <= postion_number; ++i){
            await page.evaluate(
                (index) =>{
                    document.querySelector(".table-b").rows[index].click();
                },i
            );
            await page.waitForTimeout(5000);
        }
        // get post date
        t_post_date = await page.evaluate(
            (index) =>{
                var temp_post_date = new Array();
                var temp_info = document.querySelectorAll("[ng-if = 'positionSearch.showField[2].content']");
                for (let i = 0; i < index ; ++i){
                    temp_post_date[i] = temp_info[i].textContent;
                }
                return temp_post_date;
            },postion_number
        );
        for (let i = 0; i < postion_number ; ++i){
            post_date[post_date_count++] = t_post_date[i];
        }

        // click next page button
        await page.evaluate(() =>
            document.getElementsByClassName("page-next iconfont icon-dayuhao sc-c")[0].click()
        );
        await page.waitForTimeout(8000);

    }
    for (let i = 0; i < post_date_count; ++i){
        post_date[i] = post_date[i].split('\n')[1];
        post_date[i] = replaceAll(post_date[i],' ','');
        post_date[i] = replaceAll(post_date[i],'\t','');
    }

    const role = path.slice(-10) === 'Internship' ? 'INTERNSHIP' : 'FULL-TIME';
    const now = new Date().toISOString();
    
    for (var i = 0; i < position_count ; ++i){
        var id = await hashId(postion_information[i][0]);
        var imgUrl = `https://job-scrappers-screenshots.s3.ap-southeast-1.amazonaws.com/${path}/${companyId}-${id}.png`;
        JobObjs[i] = { 
        'id': `${companyId}-${id}`, 
        'jobTitle': postion_information[i][0], 
        'role': role, 
        'companyId': companyId, 
        'companyName': companyName, 
        'link': postion_information[i][2], 
        'postDate': post_date[i], 
        'deadline': '', 
        'isAvailable': true, 
        'isHidden': '', 
        'createdAt': '', 
        'updatedAt': now,
        'industry': "Big4",
        'screenShot': imgUrl,
        'source':2
      }
    }
    console.log(JobObjs)
    await page.waitForTimeout(5000);
    await page.close(); 
    await browser.close();
    return JobObjs; 
}
 
// ScrapeDeloitte(path1,false);
// ScrapeDeloitte(path2,true);
module.exports = {ScrapeDeloitte};