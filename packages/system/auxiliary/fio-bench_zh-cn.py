#!/usr/bin/env python
# coding: utf-8

import os
import sys
import shlex
import subprocess
import json
from prettytable import PrettyTable
import argparse
from argparse import RawTextHelpFormatter

# Init ENV
rwResult={}
#Color
R = "\033[0;31;40m" #RED
G = "\033[0;32;40m" # GREEN
Y = "\033[0;33;40m" # Yellow
B = "\033[0;34;40m" # Blue
N = "\033[0m" # Reset

def bash(cmd):
	return shlex.os.system(cmd)

def format_bytes(size):
    power = 2**10
    n = 1
    power_labels = {0 : 'B/s', 1: 'KB/s', 2: 'MB/s', 3: 'GB/s', 4: 'TB/s'}
    while size > power:
        size /= power
        n += 1
    out = "{} {}".format(size,power_labels[n])
    return out

def cleanup(filename=None):
	os.remove(filename)

def printResult():
	print(G+"\n测试结果:"+N)
	table = PrettyTable(["Test Item", "读取 IOPS", "读取速度", "写入 IOPS", "写入速度"])
	for k,v in rwResult.items():
		list = [k,v["read_iops"], v["read_bw"], v["write_iops"], v["write_bw"]]
		table.add_row(list)
	table.align = "r"
	table.align["Test Item"] = "l"
	print table.get_string(sortby="Test Item", reversesort=True)

class FioTest(object):
	def __init__(self,name,filename,rw,bs,size,direct=1,iodepth=1,ioengine="libaio",runtime=60):
		self.name=name
		self.filename=filename
		self.direct=direct
		self.rw=rw
		self.bs=bs
		self.size=size
		self.iodepth=iodepth
		self.ioengine=ioengine
		self.runtime=runtime

	def exprCmd(self):
	   cmd ="fio --name="+self.name+" --rw="+self.rw+" --iodepth="+str(self.iodepth)+" --ioengine="+self.ioengine+" --thread --direct="+str(self.direct)+" --norandommap --bs="+self.bs+" --size="+self.size+" --runtime="+str(self.runtime)+" --filename="+self.filename+" --minimal --output-format=json"
	   return cmd

	def runCmd(self, cmd):
		result_str = ''
		process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
		out = process.stdout
		errors = process.stderr
		err = errors.read()
		if err:
			print(R+"运行失败!"+N)
			os._exit(1)
		result_str = out.read().strip()
		if out:
			out.close()
		if errors:
			errors.close()

		return str(result_str)

	def explain(self, result):

		if self.rw == "read" or self.rw == "randread":
			r = json.loads(result)
			iops = r["jobs"][0]["read"]["iops"]
			bw = r["jobs"][0]["read"]["bw"]
			return iops,bw
		else:
			if self.rw == "write" or self.rw == "randwrite":
				r = json.loads(result)
				iops = r["jobs"][0]["write"]["iops"]
				bw = r["jobs"][0]["write"]["bw"]
				return iops, bw

	def expResult(self, iops, bw):
		name = self.name
		rw_iops = ""
		rw_bw = ""

		if self.rw == "write":
			rw_iops = "write_iops"
			rw_bw = "write_bw"
		elif self.rw == "read":
			rw_iops = "read_iops"
			rw_bw = "read_bw"
		elif self.rw == "randwrite":
			rw_iops = "write_iops"
			rw_bw = "write_bw"
		elif self.rw == "randread":
			rw_iops = "read_iops"
			rw_bw = "read_bw"
		io_speed = format_bytes(bw)

		if name in rwResult.keys():
			rwResult[name][rw_iops] = "{:d}".format(int(iops))
			rwResult[name][rw_bw] = io_speed
		else:
			rwResult[name]={}
			rwResult[name][rw_iops] = "{:d}".format(int(iops))
			rwResult[name][rw_bw] = io_speed

	def saveResult(self):
		cmd = self.exprCmd()
		result = self.runCmd(cmd)
		iops, bw = self.explain(result)
		self.expResult(iops, bw)

if __name__ == '__main__':

	defult_path=os.getcwd()+'/fio_test.bin'
	# read parameters
	parser = argparse.ArgumentParser(prog='fio 基准测试工具', description='使用 fio 测量 HDD 和 SSD 的性能', formatter_class=RawTextHelpFormatter)
	parser.add_argument('-a', '--all', dest='alltest', action='store_true', required=False, help='完整测试 [R/W in Seq Q32T1, 4K Q32T1, Seq, 4K] (默认).')
	parser.add_argument('-t', '--test', metavar='integer', dest='test_num', type=int, default=None, required=False, nargs='+', help='可选测试 [1. Seq Q32T1], [2. 4K Q32T1], [3. Seq], [4. 4K].')
	parser.add_argument('-s', '--size', metavar='String', dest='test_size', type=str, default=None, required=False, nargs='+', help='IO 测试文件大小 (默认 2g)')
	parser.add_argument('-f', '--file', metavar='String', dest='test_file', type=str, default=None, required=False, nargs='+', help='IO 测试文件路径 (默认 {})'.format(defult_path))
	args = parser.parse_args()

	# get opts.
	test1=False
	test2=False
	test3=False
	test4=False

	if args.test_num is None or args.alltest :
		test1=True
		test2=True
		test3=True
		test4=True
	else:
		if not all(elem in range(1,4) for elem in args.test_num):
			raise ValueError('无效测试选项')
		else:
			if 1 in args.test_num: test1=True
			if 2 in args.test_num: test2=True
			if 3 in args.test_num: test3=True
			if 4 in args.test_num: test4=True
	if args.test_size is None:
		test_size = '2g'
	else:
		test_size = "".join(args.test_size)
	if args.test_file is None:
		test_file = defult_path
	else:
		test_file = "".join(args.test_file)

	print(R+'开始进行下列测试:\n'+N)
	if test1: print('- Seq Q32T1')
	if test2: print('- 4K Q32T1')
	if test3: print('- Seq')
	if test4: print('- 4K')
	print

	if test1 :
		print(Y+'测试顺序读取 - 块大小 128KiB 队列深度 32 线程数 1'+N)
		cmd = FioTest(name="Seq-Q32T1", rw="read", iodepth=32, ioengine="libaio", direct=1, bs="128k", size=test_size, runtime=60, filename=test_file)
		cmd.saveResult()
		print(Y+'测试顺序写入 - 块大小 128KiB 队列深度 32 线程数 1'+N)
		cmd = FioTest(name="Seq-Q32T1", rw="write", iodepth=32, ioengine="libaio", direct=1, bs="128k", size=test_size,runtime=60, filename=test_file)
		cmd.saveResult()

	if test2 :
		print(Y+'测试 4K 随机读取 - 队列深度 32 线程数 1'+N)
		cmd = FioTest(name="4K-Q32T1", rw="randread", iodepth=32, ioengine="libaio", direct=1, bs="4k", size=test_size, runtime=60, filename=test_file)
		cmd.saveResult()
		print(Y+'测试 4K 随机写入 - 队列深度 32 线程数 1'+N)
		cmd = FioTest(name="4K-Q32T1", rw="randwrite", iodepth=32, ioengine="libaio", direct=1, bs="4k", size=test_size, runtime=60, filename=test_file)
		cmd.saveResult()

	if test3 :
		print(Y+'测试顺序读取 - 块大小 128MiB 队列深度 1 线程数 1'+N)
		cmd = FioTest(name="Seq", rw="read", iodepth=1, ioengine="libaio", direct=1, bs="1m", size=test_size, runtime=60, filename=test_file)
		cmd.saveResult()
		print(Y+'测试顺序写入 - 块大小 128MiB 队列深度 1 线程数 1'+N)
		cmd = FioTest(name="Seq", rw="write", iodepth=1, ioengine="libaio", direct=1, bs="1m", size=test_size, runtime=60, filename=test_file)
		cmd.saveResult()

	if test4 :
		print(Y+'测试 4K 随机读取 - 队列深度 1 线程数 1'+N)
		cmd = FioTest(name="4K", rw="randread", iodepth=1, ioengine="libaio", direct=1, bs="4k", size=test_size, runtime=60, filename=test_file)
		cmd.saveResult()
		print(Y+'测试 4K 随机写入 - 队列深度 1 线程数 1'+N)
		cmd = FioTest(name="4K", rw="randwrite", iodepth=1, ioengine="libaio", direct=1, bs="4k", size=test_size, runtime=60, filename=test_file)
		cmd.saveResult()
	cleanup(filename=test_file)
	printResult()
