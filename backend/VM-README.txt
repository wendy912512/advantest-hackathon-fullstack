RTID VM package deployment
==========================

This package contains the FastAPI backend, the six persisted LightGBM sensor
models under training/models, a Linux vendor runtime, and a static frontend.

Debugger VM
-----------
Copy app, training, vendor, and requirements.txt to
/home/debugger/project/rtid-backend, then run:

  cd /home/debugger/project/rtid-backend
  export PYTHONPATH="$PWD/vendor${PYTHONPATH:+:$PYTHONPATH}"
  python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8081

User VM
-------
Copy rtid-web to /home/user/rtid-web and run:

  cd /home/user/rtid-web
  python3 -m http.server 3000 --bind 127.0.0.1

Keep this tunnel open in a separate user-VM terminal:

  ssh -N -L 8081:127.0.0.1:8081 -p 29022 debugger@advantestcell.local

The browser is then available at http://127.0.0.1:3000/temperature.

Thermal behaviour
-----------------
Sensor 1 through Sensor 6 are always returned as six fixed stages.  For an
active wafer the dashboard represents only the Device currently being tested
on each active site: after a sensor is measured, the persisted model predicts
that Device's next sensor; its actual value and error are filled in after the
next measurement arrives.
