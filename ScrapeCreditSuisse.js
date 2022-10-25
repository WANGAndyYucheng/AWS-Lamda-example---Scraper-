// TODO: time check or switch to diffent pages
// TODO: write the screen as a function

const puppeteer = require('puppeteer-core');
const chrome = require('chrome-aws-lambda');
const {uploadScreenshot} = require('./utilities');
const fns = require('date-fns');
const hashId = require('./hash')
const fs = require('fs');
// Set website you want to screenshot
const url = "https://tas-creditsuisse.taleo.net/careersection/campus/moresearch.ftl?lang=en";
const base_url = "https://tas-creditsuisse.taleo.net/careersection/campus/jobdetail.ftl?job=";
const folder = './CSScreenShot';  
const path1 = './CSScreenShot/Internship';
const path2 = './CSScreenShot/Graduate';


// if (!fs.existsSync(folder)) {
//   fs.mkdirSync(folder);
//   console.log('Create a new Folder');
// }
// if (!fs.existsSync(path1)) {
//   fs.mkdirSync(path1);
// }
// if (!fs.existsSync(path2)) {
//   fs.mkdirSync(path2);
// }

const table_months = {
  Jan: '01', January: '01',
  Feb: '02', February: '02',
  Mar: '03', March: '03',
  Apr: '04', April: '04', 
  May: '05',
  Jun: '06', June: '06',
  Jul: '07', July: '07',
  Aug: '08', August: '08',
  Sep: '09', September: '09', 
  Oct: '10', October: '10',  
  Nov: '11', November: '11',
  Dec: '12', December: '12',
}
const companyId = 'CREDIT_SUISSE';
const companyName = 'Credit Suisse';
var JobObjs = new Array();


const ScrapeCS = async (path,isFullTime) => {
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
  // // open search button
  // await page.evaluate(() =>
  //   document.querySelector(".mastercontentpanel button").click()
  // );
  // await page.waitForTimeout(5000);

  //search Hong Kong
  await page.select(
    "[id='advancedSearchInterface.location1L1']",
    "437570454433"
  );
  await page.waitForTimeout(2000);

  // click search
  await page.click("[id='advancedSearchFooterInterface.searchAction']");
  await page.waitForTimeout(2000);

  // // close search button
  // await page.evaluate(() =>
  //   document.querySelector(".mastercontentpanel button").click()
  // );
  // await page.waitForTimeout(5000);

  let error_check = 0;

  // get position box
  var box = new Array();
  box = await page.evaluate(() => {
    var postion_table = document.getElementById("requisitionListInterface.listRequisition");
    var postion_rows = postion_table.rows;
    var temp_box = new Array();
    // var startofdate = rows[0].textContent.lastIndexOf("Job Posted: ") + 12;
    for (var i = 0 ; i < postion_rows.length; i+=2){
      temp_box[i/2] = [
      postion_rows[i].getBoundingClientRect()['x'], 
      postion_rows[i].getBoundingClientRect()['y'], 
      postion_rows[i].getBoundingClientRect()['width'], 
      postion_rows[i].getBoundingClientRect()['height']]
    }
    return temp_box;
  });

  // get post date
  var post_date = new Array();
  for (var i = 1; i <= box.length; ++i){
    post_date[i-1] = await page.evaluate(
      (index) =>{
        return document.getElementById("requisitionListInterface.reqPostingDate.row" + index.toString()).textContent;
      },i
    );
  }
  for (var i = 0; i < box.length; ++i){
    [day, month, year] = post_date[i].split('-');
    post_date[i] = [year, table_months[month], day].join('-');
  }

  // get DDL box
  var DDL_box = new Array();
  var postion_name = new Array();
  var postion_ID = new Array();

  for (var i = 0; i < box.length; ++i){
    if(error_check == 1) break;
    await page.evaluate(
      (index) =>{
        document.querySelectorAll(".titlelink")[index].children[0].click();
      },i
    );
    await page.waitForTimeout(3000);
    
    // get position name
    var temp_name = await page.evaluate(() => {
      return document.getElementById("requisitionDescriptionInterface.reqTitleLinkAction.row1").textContent
    });
    postion_name[i] = temp_name;
    error_check = postion_name[i].includes("Hong Kong")?0:1;

    // get position ID
    var temp_ID = await page.evaluate(() => {
      return document.getElementById("requisitionDescriptionInterface.reqContestNumberValue.row1").textContent
    });
    postion_ID[i] = temp_ID;

    // get the DDL
    var DDL = await page.evaluate(
      (index) => {
      var all_text = document.querySelectorAll("p[style]");
      for (var j = all_text.length; j >= 0; --j){
        if (all_text[j] == null) continue;
        else if (all_text[j].textContent.toUpperCase() === "Application deadline".toUpperCase()){
          return [
            all_text[j+1].textContent, 
            [ all_text[j].getBoundingClientRect()['x'],
              all_text[j].getBoundingClientRect()['y'],
              all_text[j+1].getBoundingClientRect()['width'],
              all_text[j].getBoundingClientRect()['height']+all_text[j].getBoundingClientRect()['height']+10 ]
          ]
        }
        else continue;
      }},i
    );
    DDL_box[i] = DDL;
    
    if(error_check == 1){
      console.log(JobObjs)
      await page.waitForTimeout(3000);
      await page.close(); 
      await browser.close(); 
      return JobObjs;
    } 

    // click return 
    await page.evaluate(() =>
      document.querySelector("[title='Return to the previous page']").click()
    );
    await page.waitForTimeout(3000);
  }

  for (var i = 0; i < box.length; ++i){
    if(DDL_box[i] != undefined){
      [first_half, second_half] = DDL_box[i][0].split(",");
      [month, day] = first_half.split(" ");
      year = second_half.substring(1,5);
      DDL_box[i][0] = [year, table_months[month], day.length == 1 ? '0'+day : day].join("-");
    }
  }

  const role = path.slice(-10) === 'Internship' ? 'INTERNSHIP' : 'FULL-TIME';
  const now = new Date().toISOString();
  
  for (var i = 0; i < box.length; ++i){
    var imgUrl = `https://job-scrappers-screenshots.s3.ap-southeast-1.amazonaws.com/${path}/${companyId}-${postion_ID[i]}.png`;
    JobObjs[i] = { 
      'id': `${companyId}-${postion_ID[i]}`, 
      'jobTitle': postion_name[i], 
      'role': role, 
      'companyId': companyId, 
      'companyName': companyName, 
      'link': `${base_url}${postion_ID[i]}`, 
      'postDate': post_date[i], 
      'deadline': DDL_box[i] == undefined ? '' : DDL_box[i][0], 
      'isAvailable': true, 
      'isHidden': '', 
      'createdAt': '', 
      'updatedAt': now,
      'industry': "Investment Banking",
      'screenShot': imgUrl,
      'source':2
    }
  }
  await page.waitForTimeout(3000);

  // scrape position infomation
  var x,y,w,h;
  for (var i = 0 ; i < box.length; ++i){
    x = box[i][0];
    y = box[i][1];
    w = box[i][2];
    h = box[i][3];
    const image = await page.screenshot({encoding:"base64" , 'clip': {'x': x, 'y': y, 'width': w, 'height': h}});
    await uploadScreenshot(image, path + '/' + JobObjs[i].id + '.png');
  }
  

  // scrape DDL
  for (var i = 0 ; i < box.length; ++i){
    if(DDL_box[i] == undefined)continue;

    await page.evaluate(
      (index) =>{
        document.querySelectorAll(".titlelink")[index].children[0].click();
      },i
    );
    await page.waitForTimeout(3000);

    x = DDL_box[i][1][0];
    y = DDL_box[i][1][1];
    w = DDL_box[i][1][2];
    h = DDL_box[i][1][3];

    const image = await page.screenshot({encoding:"base64" , 'clip': {'x': x, 'y': y, 'width': w, 'height': h}});
    await uploadScreenshot(image, path + '/' + JobObjs[i].id + '_DDL.png');

     // click return 
    await page.evaluate(() =>
      document.querySelector("[title='Return to the previous page']").click()
    );
    await page.waitForTimeout(3000);
  }
  console.log(JobObjs)
  await page.waitForTimeout(3000);
  await page.close(); 
  await browser.close(); 
  return JobObjs;
}
 
//ScrapeCS(path1, false);
module.exports = {ScrapeCS};