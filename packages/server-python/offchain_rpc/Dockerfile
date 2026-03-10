FROM python:3.12-slim
RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y wamerican git
RUN apt-get install -y gcc libgmp-dev

# This Dockerfile must be run from the '..' context as it performs
# a local build of the hybrid_compute_sdk package and then builds a
# matching offchain_rpc image.

COPY . /
RUN pip install setuptools wheel
RUN python setup.py bdist_wheel
RUN ls -l dist
RUN pip3 install dist/hybrid_compute_sdk-*-py3-none-any.whl

RUN pip3 install --default-timeout=100 -r requirements.txt

CMD [ "python", "-u", "./offchain.py" ]
