# Duplicated path search in Swift resolvers

ThinkMCPCommandResolver and ThinkCLICommandResolver have nearly identical upward-search logic (searchRoots, searchUpwards, environment fallbacks). The algorithm is copy-pasted across two files. Should extract a shared PathSearcher utility.
