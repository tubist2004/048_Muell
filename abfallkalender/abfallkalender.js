var https = require("https");
var http = require("http");
var xpath = require("xpath"),
  dom = require("xmldom").DOMParser;
const ical = require("ical-generator");
var moment = require("moment");

moment.locale("de");

http
  .createServer(function (servreq, servres) {
    const options = {
      hostname: "api.abfallplus.de",
      port: 443,
      path: "/?key=477b9513bc190ecec8582cac75d9f77f",
      method: "GET",
    };

    const regex = /(?<=modus=)[0-9a-f]*/m;

    var i = 0;

    const calendar = ical({ name: "Abfallkalender 2021" });
    const entries = [];

    function getScriptCB(res) {
      res.on("data", (d) => {
        //console.log("script: " + regex.exec(d));
        options.path =
          "/?key=477b9513bc190ecec8582cac75d9f77f&modus=" + regex.exec(d);
        const req = https.request(options, getWurlCB);
        req.end();
      });
    }

    function getWurlCB(res) {
      res.on("data", (d) => {
        //console.log("Wurl: " + regex.exec(d));
        options.path =
          "/?key=477b9513bc190ecec8582cac75d9f77f&modus=" +
          regex.exec(d) +
          "&waction=init";
        const req = https.request(options, getInit);
        req.end();
      });
    }

    function getInit(res) {
      var str = "";
      res.on("data", (d) => {
        str += d;
      });
      res.on("end", () => {
        //console.log("init: " + regex.exec(str));
        options.path =
          "/?key=477b9513bc190ecec8582cac75d9f77f&modus=" +
          regex.exec(str) +
          "&waction=export_txt";
        const postName = /(?<=name=")[0-9a-f]*/.exec(str);
        const postValue = /(?<=value=")[0-9a-f]*/.exec(str);
        var postMessage =
          postName +
          "=" +
          postValue +
          "&f_id_kommune=4184" +
          "&f_id_strasse=16776" +
          "&f_id_abfalltyp_0=27" +
          "&f_id_abfalltyp_1=20" +
          "&f_id_abfalltyp_2=17" +
          "&f_id_abfalltyp_3=31" +
          "&f_abfallarten_index_max=4" +
          "&f_abfallarten=27%2C20%2C17%2C31" +
          "&f_zeitraum=20220101-20221231" +
          "&f_export_als=%7B%27action%27%3A%27https%3A%2F%2Fapi.abfallplus.de%2F%3Fkey%3D477b9513bc190ecec8582cac75d9f77f%26modus%3D" +
          regex.exec(str) +
          "%26waction%3Dexport_txt%27%2C%27target%27%3A%27_blank%27%7D";
        options.method = "POST";
        options.headers = {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": postMessage.length,
        };
        const req = https.request(options, getModus);
        req.on("error", (error) => {
          console.error(error);
        });
        req.write(postMessage);
        req.end();
      });
    }

    function getModus(res) {
      res.on("data", (d) => {
        d = (d + "").replace('initial-scale=1">', 'initial-scale=1" />');
        var doc = new dom().parseFromString(d);
        var nodes = xpath.select("//*[local-name(.)='p']", doc, false);
        nodes.forEach((node) => {
          //console.log("Name: " + node.childNodes[0]);
          const dates = node.childNodes[2]
            .toString()
            .split(",")
            .forEach((d) => {
              d = moment(d.trim() + ".2022", "DD.MM.YYYY");
              calendar.createEvent({
                start: d.add(1, "hour"),
                summary: node.childNodes[0],
                description: "It works ;)",
                timezone: "Europe/Berlin",
                allDay: true,
                alarms: [
                  {
                    triggerBefore: 6 * 3600,
                    type: "display",
                  },
                ],
              });
              entries.push({
                date: d.add(1, "hour"),
                summary: node.childNodes[0].toString(),
              });
            });
        });
      });
      res.on("end", () => {
        if (servreq.url == "/") {
          servres.write(calendar.toString()); //write a response to the client
          console.log(
            "fetched resource '/' to " + servres.socket.remoteAddress
          );
        } else if (servreq.url == "/next") {
          servres.write(
            JSON.stringify(
              entries
                .filter((e) => {
                  return e.date.isBetween(
                    moment().startOf("day"),
                    moment().endOf("day").add(14, "day")
                  );
                })
                .map((e) => {
                  if (e.date.isBefore(moment().endOf("day"))) {
                    e.text = "Heute: " + e.summary;
                  } else if (
                    e.date.isBefore(moment().endOf("day").add(1, "day"))
                  ) {
                    e.text = "Morgen: " + e.summary;
                  } else {
                    e.text = e.date.format("dddd") + ": " + e.summary;
                  }
                  return e;
                })
            )
          );
          console.log(
            "fetched resource '/next' to " + servres.socket.remoteAddress
          );
        }
        servres.end(); //end the response
      });
    }

    const req = https.request(options, getScriptCB);
    req.end();
  })
  .listen(process.env.NODE_PORT); //the server object listens on port 8080
