FROM python:3.12-slim
RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y wamerican git
RUN apt-get install -y gcc libgmp-dev
COPY . /

#To force a build with the local version of the hybrid_compute_sdk,
#build it in the parent directory using:
#  pip install setuptools wheel
#  python setup.py bdist_wheel
#Then copy the output from dist/ into this dir. Uncomment the following
#line and edit the version string.
RUN pip3 install ./hybrid_compute_sdk-0.2.44-py3-none-any.whl

RUN pip3 install --default-timeout=100 -r requirements.txt

CMD [ "python", "-u", "./offchain.py" ]
