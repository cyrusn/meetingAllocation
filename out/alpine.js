const version = "v5.0.2";
const FILENAME = `result.${version}.json`;

const groupBy = function (xs, key) {
  return xs.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

document.addEventListener("alpine:init", () => {
  Alpine.data("documentData", () => ({
    isShowUpdates: false,
    isActive: false,
    isShowFutureMeetings: false,
    filter: "",
    meetingData: null,
    fetchMeetingData() {
      const filename = FILENAME;
      fetch(`${filename}?nocache=${new Date().getTime()}`)
        .then((response) => response.json())
        .then(
          function (json) {
            this.meetingData = json;
          }.bind(this),
        )
        .then(function () {
          const id = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Hong_Kong",
          });

          const element = document.getElementById(id);

          if (element) {
            element.scrollIntoView({
              behavior: "smooth",
            });
          }
        });
    },
    init() {
      this.fetchMeetingData();
    },
    get version() {
      if (!this.meetingData) return "";
      return this.meetingData.version;
    },
    get title() {
      if (!this.meetingData) return "";
      const { title, version } = this.meetingData;
      return title;
    },
    get updatedMeetings() {
      if (!this.meetingData) return [];

      return this.meetingData.updatedMeetings;
    },
    get timestamp() {
      if (!this.meetingData) return "";
      const { timestamp } = this.meetingData;
      return new Date(timestamp).toLocaleString();
    },
    get meetings() {
      if (!this.meetingData) return [];
      const { data } = this.meetingData;
      const now = new Date();
      const { isShowFutureMeetings } = this;

      return data
        .filter(({ slot }) => {
          if (!isShowFutureMeetings) {
            // show events after 3 * 60 * 60 * 1000
            return new Date(slot) - now > -10800000;
          }
          return true
        })
        .filter(({ members, principals, pics }) => {
          if (this.filter) {
            return members
              .concat(principals)
              .concat(pics)
              .includes(this.filter.toUpperCase());
          }

          return true;
        });
    },
    get table() {
      if (!this.meetings.length) return "";

      const schedules = this.meetings.map((s) => {
        const [date, time] = s.slot.split("T");
        return Object.assign(s, { date, time });
      });

      const groupedSchedulesByDate = groupBy(schedules, "date");
      const dates = Object.keys(groupedSchedulesByDate);
      let tables = `
<table class="table is-bordered is-striped is-narrow is-hoverable is-fullwidth">
  <tr>
    <th>Date</th>
    <th>Time</th>
    <th>Meeting</th>
    <th>Location</th>
    <th>Duration</th>
    <th>
      <span class='has-text-danger'>Principals</span>, 
      <span class='has-text-info'>PIC</span> and Attendees
    </th>
  </tr>`;
      dates.forEach((date) => {
        //  const displaySlot = slot.split('T').join('\n').replace(":00.000+08:00", "")
        const schedules = groupedSchedulesByDate[date];
        const groupedSchedulesByTime = groupBy(schedules, "time");
        const times = Object.keys(groupedSchedulesByTime);
        let rowspan = 0;

        const sessions = times.map((time) => {
          const schedules = groupedSchedulesByTime[time];
          const timeRowspan = schedules.length;

          const rows = schedules.map((s) => {
            rowspan += 1;
            const {
              name,
              cname,
              location,
              principals,
              pics,
              duration,
              members,
              remark,
            } = s;
            return `
  <td>${cname}<br>${name}${remark ? '<p class="help is-info">' + remark + "</p>" : ""}</td>
  <td>${location}</td> <td>${duration}hrs</td>
  <td width='40%'> 
    <span class='has-text-danger'
      >${principals.filter((p) => !pics.includes(p)).join(", ")}</span
      >${principals.filter((p) => !pics.includes(p)).length ? ", " : ""}<span 
      class='has-text-info'>${pics.join(", ")}</span>${pics.length ? ", " : ""}<span
      >${members.filter((m) => ![...principals, ...pics].includes(m)).join(", ")}</span>
  </td>`;
          });
          return `<td rowspan="${timeRowspan}">${time.slice(0, 5)}
            </td>${rows.join("</tr><tr>")} `;
        });
        tables += `<tr id='${date}' style='scroll-margin-top: 80px;'><td rowspan="${rowspan}">${date}</td>`;
        tables += sessions.join("</tr><tr>");
        tables += "</tr>";
      });

      tables += "</table>";
      return tables;
    },
  }));
});
