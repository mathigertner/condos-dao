//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract Vault {
    uint256 public constant VERSION = 100;
    address private DAO;

    modifier onlyDAO() {
        require(
            msg.sender == DAO,
            "Solo el contrato DAO puede interaccionar con este contrato"
        );
        _;
    }

    function withdraw(uint256 amount, address _member) external onlyDAO {
        payable(_member).transfer(amount);
    }
}
